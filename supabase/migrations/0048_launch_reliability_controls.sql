-- Launch reliability controls: persisted notifications, host eligibility,
-- required profile photos for marketplace participation, and automatic host
-- settlement after a completed game.

create table user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('payment', 'waitlist_promoted', 'host_earnings', 'payout', 'game', 'system')),
  title text not null check (char_length(title) between 1 and 140),
  body text not null check (char_length(body) between 1 and 500),
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index user_notifications_feed_idx on user_notifications (user_id, read_at, created_at desc);
alter table user_notifications enable row level security;
create policy user_notifications_read_own on user_notifications for select using (user_id = auth.uid());
create policy user_notifications_mark_read_own on user_notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on user_notifications from anon, authenticated;
grant select, update (read_at) on user_notifications to authenticated;

create table host_player_exclusions (
  host_id uuid not null references profiles(id) on delete cascade,
  player_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (host_id, player_id),
  check (host_id <> player_id)
);

alter table host_player_exclusions enable row level security;
create policy host_player_exclusions_read_own on host_player_exclusions for select using (host_id = auth.uid());
revoke all on host_player_exclusions from anon, authenticated;
grant select on host_player_exclusions to authenticated;

create or replace function set_host_player_exclusion(p_player_id uuid, p_excluded boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid := auth.uid();
  v_no_shows int;
begin
  if v_host is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_player_id is null or p_player_id = v_host then raise exception 'invalid player' using errcode = 'P0001'; end if;

  if not p_excluded then
    delete from host_player_exclusions where host_id = v_host and player_id = p_player_id;
    return;
  end if;

  select count(*) into v_no_shows
    from game_participants gp
    join games g on g.id = gp.game_id
   where g.host_id = v_host and gp.user_id = p_player_id and gp.status = 'no_show';
  if v_no_shows < 3 then
    raise exception 'a host can only decline a player after three no-shows in their sessions' using errcode = 'P0001';
  end if;

  insert into host_player_exclusions (host_id, player_id) values (v_host, p_player_id)
  on conflict do nothing;
end;
$$;

grant execute on function set_host_player_exclusion(uuid, boolean) to authenticated;

-- A player cannot use a marketplace action without a recognisable profile
-- photo. The host is excluded because host_game creates their participant row
-- as part of the reservation itself; hosting is pre-checked in the app.
create or replace function require_profile_photo_for_game_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
begin
  if TG_OP = 'UPDATE' and not (old.status = 'withdrawn' and new.status in ('confirmed', 'pending_payment', 'waitlist')) then
    return new;
  end if;
  select host_id into v_host from games where id = new.game_id;
  if new.user_id <> v_host and exists (
    select 1 from host_player_exclusions where host_id = v_host and player_id = new.user_id
  ) then
    raise exception 'this host is not accepting you into future games' using errcode = 'P0001';
  end if;
  if new.user_id <> v_host and not exists (
    select 1 from profiles where id = new.user_id and nullif(trim(coalesce(avatar_url, '')), '') is not null
  ) then
    raise exception 'add a clear profile photo before joining a game' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists game_participants_require_profile_photo on game_participants;
create trigger game_participants_require_profile_photo
before insert or update of status on game_participants
for each row execute function require_profile_photo_for_game_participant();

create or replace function require_profile_photo_for_marketplace_action()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := case when TG_TABLE_NAME = 'bookings' then new.user_id else new.host_id end;
begin
  if not exists (
    select 1 from profiles where id = v_user and nullif(trim(coalesce(avatar_url, '')), '') is not null
  ) then
    raise exception 'add a clear profile photo before booking or hosting' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_require_profile_photo on bookings;
create trigger bookings_require_profile_photo before insert on bookings
for each row execute function require_profile_photo_for_marketplace_action();

drop trigger if exists games_require_profile_photo on games;
create trigger games_require_profile_photo before insert on games
for each row execute function require_profile_photo_for_marketplace_action();

-- Promotion is the durable moment a waitlisted player gets a place. This
-- trigger works for a voluntary leave, an expired payment hold, and admin
-- interventions without duplicating notification logic in every RPC.
create or replace function notify_waitlist_promotion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
  v_title text;
begin
  if old.status = 'waitlist' and new.status in ('confirmed', 'pending_payment') then
    select slug, title into v_slug, v_title from games where id = new.game_id;
    insert into user_notifications (user_id, kind, title, body, href)
    values (
      new.user_id,
      'waitlist_promoted',
      'A place opened up',
      case when new.status = 'pending_payment'
        then 'Complete payment to secure your place in ' || coalesce(v_title, 'this game') || '.'
        else 'You are now confirmed for ' || coalesce(v_title, 'this game') || '.' end,
      '/games/' || coalesce(v_slug, '')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists game_participants_waitlist_notification on game_participants;
create trigger game_participants_waitlist_notification
after update of status on game_participants
for each row execute function notify_waitlist_promotion();

-- Service-role-only settlement. It repeats the existing settlement arithmetic
-- under a single transaction per game, making the host UI button optional.
create or replace function settle_ended_host_games()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game games%rowtype;
  v_collected bigint;
  v_recovery bigint;
  v_earnings bigint;
  v_balance bigint;
  v_count int := 0;
  v_ref text;
begin
  for v_game in
    select * from games
     where upper(during) <= now()
       and status in ('open', 'locked', 'played')
       and minimum_decision_status in ('go_ahead', 'not_needed')
       and host_paid_kobo > 0
     for update skip locked
  loop
    select coalesce(sum(paid_kobo), 0) into v_collected
      from game_participants
     where game_id = v_game.id and status in ('confirmed', 'played', 'no_show');
    v_recovery := greatest(0, least(v_collected, v_game.host_pitch_cost_kobo) - v_game.host_reimbursed_kobo);
    v_earnings := greatest(0, (v_collected - v_game.host_pitch_cost_kobo) - v_game.host_earnings_kobo);
    if v_recovery = 0 and v_earnings = 0 then continue; end if;

    insert into wallets (user_id, balance_kobo) values (v_game.host_id, 0) on conflict (user_id) do nothing;
    if v_recovery > 0 then
      update wallets set balance_kobo = balance_kobo + v_recovery, updated_at = now() where user_id = v_game.host_id returning balance_kobo into v_balance;
      update games set host_reimbursed_kobo = host_reimbursed_kobo + v_recovery where id = v_game.id;
      v_ref := 'HRB-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, game_id)
      values (v_game.host_id, 'host_reimbursement', 'completed', v_recovery, v_balance, v_ref, v_game.id);
    end if;
    if v_earnings > 0 then
      update wallets set balance_kobo = balance_kobo + v_earnings, updated_at = now() where user_id = v_game.host_id returning balance_kobo into v_balance;
      update games set host_earnings_kobo = host_earnings_kobo + v_earnings where id = v_game.id;
      v_ref := 'HPE-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, game_id)
      values (v_game.host_id, 'host_game_earnings', 'completed', v_earnings, v_balance, v_ref, v_game.id);
    end if;
    insert into user_notifications (user_id, kind, title, body, href)
    values (v_game.host_id, 'host_earnings', 'Host earnings settled', 'Your completed game earnings are now available in Tempo credit.', '/wallet');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function settle_ended_host_games() from public, anon, authenticated;
grant execute on function settle_ended_host_games() to service_role;
