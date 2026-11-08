-- Recurring squads & private leagues.
--
-- A squad is a persistent group of players. It owns a saved weekly
-- recurring-game template (either a real Tempo pitch or an off-platform
-- venue, mirroring host_game()/host_off_platform_game()'s two insert
-- shapes), and a daily cron turns that template into an ordinary hosted
-- game each week. Members are notified, not auto-joined — they use the
-- existing join_game() flow unchanged, so no new money logic is needed
-- there. A squad's games are fully private to its members: this is the one
-- part of this migration that tightens previously wide-open RLS
-- (games_read, participants_read), gated on a column that is null for
-- every pre-existing row so normal games keep today's public behavior.

create table squads (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null check (length(btrim(name)) between 2 and 60),
  description text not null default '',
  area        text,
  owner_id    uuid not null references profiles(id) on delete restrict,
  created_at  timestamptz not null default now()
);

create table squad_members (
  squad_id  uuid not null references squads(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  role      text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (squad_id, user_id)
);

create index squad_members_user_idx on squad_members (user_id);

create table squad_invites (
  id         uuid primary key default gen_random_uuid(),
  squad_id   uuid not null references squads(id) on delete cascade,
  code       text unique not null,
  created_by uuid not null references profiles(id) on delete cascade,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table squad_recurring_templates (
  id                        uuid primary key default gen_random_uuid(),
  squad_id                  uuid not null references squads(id) on delete cascade,
  day_of_week               int not null check (day_of_week between 0 and 6),
  start_minute              int not null check (start_minute between 0 and 1439),
  duration_minutes          int not null check (duration_minutes between 30 and 240),
  capacity                  int not null check (capacity between 2 and 30),
  minimum_to_guarantee      int not null check (minimum_to_guarantee >= 2),
  price_per_player_kobo     bigint not null check (price_per_player_kobo >= 0),
  bibs_provided             boolean not null default false,
  venue_mode                text not null check (venue_mode in ('pitch', 'off_platform')),
  pitch_id                  uuid references pitches(id) on delete set null,
  venue_name                text,
  venue_area                text,
  venue_address             text,
  enabled                   boolean not null default true,
  last_generated_occurrence timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint squad_template_guarantee_within_capacity check (minimum_to_guarantee <= capacity),
  constraint squad_template_venue_source_xor check ((pitch_id is not null) <> (venue_name is not null)),
  constraint squad_template_pitch_mode check (venue_mode <> 'pitch' or pitch_id is not null),
  constraint squad_template_off_platform_mode check (venue_mode <> 'off_platform' or venue_name is not null)
);

create index squad_recurring_templates_squad_idx on squad_recurring_templates (squad_id);
create index squad_recurring_templates_enabled_idx on squad_recurring_templates (enabled);

create or replace function touch_squad_recurring_template()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger squad_recurring_templates_touch
before update on squad_recurring_templates
for each row execute function touch_squad_recurring_template();

alter table games
  add column if not exists squad_id uuid references squads(id) on delete set null,
  add column if not exists recurring_template_id uuid references squad_recurring_templates(id) on delete set null;

create index games_squad_idx on games (squad_id) where squad_id is not null;

-- ----------------------------------------------------------------------------
-- Membership helpers, same shape as is_venue_owner() (0033).

-- security definer is required here (unlike is_venue_owner()'s plain
-- `profiles` lookup): these are called from squad_members_read's own USING
-- clause, and squad_members is the table they query, so without definer
-- semantics the inner lookup would recurse through the same RLS policy.
create or replace function is_squad_member(p_squad_id uuid, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from squad_members
     where squad_id = p_squad_id and user_id = coalesce(p_user, auth.uid())
  );
$$;

create or replace function is_squad_owner(p_squad_id uuid, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from squad_members
     where squad_id = p_squad_id and user_id = coalesce(p_user, auth.uid()) and role = 'owner'
  );
$$;

grant execute on function is_squad_member(uuid, uuid) to authenticated, anon;
grant execute on function is_squad_owner(uuid, uuid) to authenticated, anon;

-- ----------------------------------------------------------------------------
-- RLS.

alter table squads enable row level security;
alter table squad_members enable row level security;
alter table squad_invites enable row level security;
alter table squad_recurring_templates enable row level security;

create policy squads_read on squads for select
  using (is_squad_member(id) or is_admin());

create policy squad_members_read on squad_members for select
  using (is_squad_member(squad_id) or is_admin());

create policy squad_invites_rw on squad_invites for all
  using (is_squad_owner(squad_id) or is_admin())
  with check (is_squad_owner(squad_id) or is_admin());

create policy squad_recurring_templates_read on squad_recurring_templates for select
  using (is_squad_member(squad_id) or is_admin());

create policy squad_recurring_templates_write on squad_recurring_templates for all
  using (is_squad_owner(squad_id) or is_admin())
  with check (is_squad_owner(squad_id) or is_admin());

-- Previously `using (true)` — fully public. Narrowed to exclude squad-private
-- games for non-members; every existing row has squad_id null, so ordinary
-- games are completely unaffected.
drop policy if exists games_read on games;
create policy games_read on games for select
  using (squad_id is null or is_squad_member(squad_id) or is_admin());

drop policy if exists participants_read on game_participants;
create policy participants_read on game_participants for select
  using (
    exists (
      select 1 from games g
       where g.id = game_participants.game_id
         and (g.squad_id is null or is_squad_member(g.squad_id) or is_admin())
    )
  );

-- ----------------------------------------------------------------------------
-- join_game(): one new check so a non-member can't join a squad-private game
-- even with a known game id. Otherwise identical to 0039's version.

create or replace function join_game(p_game_id uuid)
returns game_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_game games%rowtype;
  v_count int;
  v_status participant_status;
  v_row game_participants%rowtype;
  v_balance bigint;
  v_charge bigint := 0;
  v_ref text;
begin
  if v_user is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if exists (select 1 from profiles where id = v_user and suspended) then raise exception 'account suspended' using errcode = '42501'; end if;

  select * into v_game from games where id = p_game_id for update;
  if not found then raise exception 'game not found' using errcode = 'P0002'; end if;
  if v_game.squad_id is not null and not is_squad_member(v_game.squad_id, v_user) and not is_admin() then
    raise exception 'this game is private to squad members' using errcode = '42501';
  end if;
  if v_game.status not in ('open', 'locked') then raise exception 'game is not open' using errcode = 'P0001'; end if;
  if lower(v_game.during) <= now() then raise exception 'game has already started' using errcode = 'P0001'; end if;
  if exists (select 1 from game_participants where game_id = p_game_id and user_id = v_user and status <> 'withdrawn') then
    raise exception 'already a participant in this game' using errcode = 'P0001';
  end if;

  select coalesce(v_game.preconfirmed_player_count, 0) + count(*) into v_count
    from game_participants
   where game_id = p_game_id and status in ('confirmed', 'pending_payment');
  v_status := case when v_count >= v_game.capacity then 'waitlist' else 'confirmed' end;

  if v_status = 'confirmed' and v_game.price_per_player_kobo > 0 then
    insert into wallets (user_id, balance_kobo) values (v_user, 0) on conflict (user_id) do nothing;
    select balance_kobo into v_balance from wallets where user_id = v_user for update;
    v_charge := least(v_balance, v_game.price_per_player_kobo);
    if v_charge > 0 then
      update wallets set balance_kobo = balance_kobo - v_charge, updated_at = now() where user_id = v_user;
      v_ref := 'GPY-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, game_id)
      values (v_user, 'game_payment', 'completed', -v_charge, v_balance - v_charge, v_ref, p_game_id);
    end if;
    if v_charge < v_game.price_per_player_kobo then v_status := 'pending_payment'; end if;
  end if;

  insert into game_participants (game_id, user_id, status, paid_kobo, payment_deadline)
  values (p_game_id, v_user, v_status, v_charge,
    case when v_status = 'pending_payment' then least(now() + interval '48 hours', lower(v_game.during) - interval '2 hours') else null end)
  on conflict (game_id, user_id) do update
    set status = case when game_participants.status = 'withdrawn' then excluded.status else game_participants.status end,
        paid_kobo = case when game_participants.status = 'withdrawn' then excluded.paid_kobo else game_participants.paid_kobo end,
        payment_deadline = case when game_participants.status = 'withdrawn' then excluded.payment_deadline else game_participants.payment_deadline end
  returning * into v_row;

  if v_status in ('confirmed', 'pending_payment') and v_count + 1 >= v_game.capacity then
    update games set status = 'locked' where id = p_game_id;
  end if;
  if v_status in ('confirmed', 'pending_payment') then perform refresh_game_minimum_status(p_game_id); end if;
  return v_row;
end;
$$;

grant execute on function join_game(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Squad CRUD + membership.

create or replace function create_squad(p_name text, p_description text, p_area text)
returns squads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_squad squads%rowtype;
  v_slug text;
begin
  if v_user is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if exists (select 1 from profiles where id = v_user and suspended) then
    raise exception 'account suspended' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_name, ''))) not between 2 and 60 then
    raise exception 'give your squad a name' using errcode = 'P0001';
  end if;

  v_slug := lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || substr(md5(random()::text), 1, 6);

  insert into squads (slug, name, description, area, owner_id)
  values (v_slug, btrim(p_name), coalesce(p_description, ''), p_area, v_user)
  returning * into v_squad;

  insert into squad_members (squad_id, user_id, role) values (v_squad.id, v_user, 'owner');

  return v_squad;
end;
$$;

grant execute on function create_squad(text, text, text) to authenticated;

create or replace function create_squad_invite(p_squad_id uuid)
returns squad_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_invite squad_invites%rowtype;
begin
  if v_user is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not is_squad_owner(p_squad_id, v_user) then raise exception 'owner access required' using errcode = '42501'; end if;

  insert into squad_invites (squad_id, code, created_by)
  values (p_squad_id, upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)), v_user)
  returning * into v_invite;

  return v_invite;
end;
$$;

grant execute on function create_squad_invite(uuid) to authenticated;

create or replace function revoke_squad_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_invite squad_invites%rowtype;
begin
  if v_user is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into v_invite from squad_invites where id = p_invite_id;
  if not found then raise exception 'invite not found' using errcode = 'P0002'; end if;
  if not is_squad_owner(v_invite.squad_id, v_user) then raise exception 'owner access required' using errcode = '42501'; end if;

  update squad_invites set revoked_at = now() where id = p_invite_id;
end;
$$;

grant execute on function revoke_squad_invite(uuid) to authenticated;

-- No auth required — lets a logged-out invite link show a preview before
-- login/signup, without exposing the full squads table to the public.
create or replace function get_squad_preview_by_code(p_code text)
returns table (squad_id uuid, name text, area text, member_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.name, s.area, (select count(*) from squad_members m where m.squad_id = s.id)
    from squad_invites i
    join squads s on s.id = i.squad_id
   where i.code = upper(btrim(p_code))
     and i.revoked_at is null
     and (i.expires_at is null or i.expires_at > now())
   limit 1;
$$;

grant execute on function get_squad_preview_by_code(text) to authenticated, anon;

create or replace function join_squad_by_code(p_code text)
returns squads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_invite squad_invites%rowtype;
  v_squad squads%rowtype;
  v_member_count int;
begin
  if v_user is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if exists (select 1 from profiles where id = v_user and suspended) then
    raise exception 'account suspended' using errcode = '42501';
  end if;

  select * into v_invite from squad_invites
   where code = upper(btrim(p_code)) and revoked_at is null and (expires_at is null or expires_at > now());
  if not found then raise exception 'that invite link is no longer valid' using errcode = 'P0002'; end if;

  select * into v_squad from squads where id = v_invite.squad_id for update;
  if not found then raise exception 'squad not found' using errcode = 'P0002'; end if;

  if exists (select 1 from squad_members where squad_id = v_squad.id and user_id = v_user) then
    return v_squad;
  end if;

  select count(*) into v_member_count from squad_members where squad_id = v_squad.id;
  if v_member_count >= 40 then
    raise exception 'this squad is full' using errcode = 'P0001';
  end if;

  insert into squad_members (squad_id, user_id, role) values (v_squad.id, v_user, 'member')
    on conflict do nothing;

  return v_squad;
end;
$$;

grant execute on function join_squad_by_code(text) to authenticated;

create or replace function leave_squad(p_squad_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_other_members int;
begin
  if v_user is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  select role into v_role from squad_members where squad_id = p_squad_id and user_id = v_user;
  if v_role is null then raise exception 'not a member of this squad' using errcode = 'P0001'; end if;

  if v_role = 'owner' then
    select count(*) into v_other_members from squad_members where squad_id = p_squad_id and user_id <> v_user;
    if v_other_members > 0 then
      raise exception 'remove the other members, or transfer ownership, before leaving' using errcode = 'P0001';
    end if;
    delete from squads where id = p_squad_id;
    return;
  end if;

  delete from squad_members where squad_id = p_squad_id and user_id = v_user;
end;
$$;

grant execute on function leave_squad(uuid) to authenticated;

create or replace function remove_squad_member(p_squad_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not is_squad_owner(p_squad_id, v_user) then raise exception 'owner access required' using errcode = '42501'; end if;
  if p_user_id = v_user then raise exception 'use leave_squad instead' using errcode = 'P0001'; end if;

  delete from squad_members where squad_id = p_squad_id and user_id = p_user_id;
end;
$$;

grant execute on function remove_squad_member(uuid, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Recurring template CRUD.

create or replace function save_squad_recurring_template(
  p_squad_id uuid,
  p_template_id uuid,
  p_day_of_week int,
  p_start_minute int,
  p_duration_minutes int,
  p_capacity int,
  p_minimum_to_guarantee int,
  p_price_per_player_kobo bigint,
  p_bibs_provided boolean,
  p_venue_mode text,
  p_pitch_id uuid,
  p_venue_name text,
  p_venue_area text,
  p_venue_address text
)
returns squad_recurring_templates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row squad_recurring_templates%rowtype;
begin
  if v_user is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not is_squad_owner(p_squad_id, v_user) then raise exception 'owner access required' using errcode = '42501'; end if;
  if p_minimum_to_guarantee > p_capacity then
    raise exception 'minimum cannot exceed capacity' using errcode = 'P0001';
  end if;
  if p_venue_mode = 'pitch' then
    if p_pitch_id is null then raise exception 'choose a pitch' using errcode = 'P0001'; end if;
    if not exists (select 1 from pitches where id = p_pitch_id and active) then
      raise exception 'that pitch is not available' using errcode = 'P0001';
    end if;
  elsif p_venue_mode = 'off_platform' then
    if length(btrim(coalesce(p_venue_name, ''))) not between 2 and 120 then
      raise exception 'enter the venue name' using errcode = 'P0001';
    end if;
    if length(btrim(coalesce(p_venue_area, ''))) not between 2 and 60 then
      raise exception 'enter the venue area' using errcode = 'P0001';
    end if;
    if length(btrim(coalesce(p_venue_address, ''))) not between 5 and 240 then
      raise exception 'enter the venue address' using errcode = 'P0001';
    end if;
  else
    raise exception 'invalid venue mode' using errcode = 'P0001';
  end if;

  if p_template_id is not null then
    update squad_recurring_templates set
      day_of_week = p_day_of_week,
      start_minute = p_start_minute,
      duration_minutes = p_duration_minutes,
      capacity = p_capacity,
      minimum_to_guarantee = p_minimum_to_guarantee,
      price_per_player_kobo = p_price_per_player_kobo,
      bibs_provided = p_bibs_provided,
      venue_mode = p_venue_mode,
      pitch_id = case when p_venue_mode = 'pitch' then p_pitch_id else null end,
      venue_name = case when p_venue_mode = 'off_platform' then btrim(p_venue_name) else null end,
      venue_area = case when p_venue_mode = 'off_platform' then btrim(p_venue_area) else null end,
      venue_address = case when p_venue_mode = 'off_platform' then btrim(p_venue_address) else null end
    where id = p_template_id and squad_id = p_squad_id
    returning * into v_row;
    if not found then raise exception 'template not found' using errcode = 'P0002'; end if;
  else
    insert into squad_recurring_templates (
      squad_id, day_of_week, start_minute, duration_minutes, capacity, minimum_to_guarantee,
      price_per_player_kobo, bibs_provided, venue_mode, pitch_id, venue_name, venue_area, venue_address
    ) values (
      p_squad_id, p_day_of_week, p_start_minute, p_duration_minutes, p_capacity, p_minimum_to_guarantee,
      p_price_per_player_kobo, coalesce(p_bibs_provided, false), p_venue_mode,
      case when p_venue_mode = 'pitch' then p_pitch_id else null end,
      case when p_venue_mode = 'off_platform' then btrim(p_venue_name) else null end,
      case when p_venue_mode = 'off_platform' then btrim(p_venue_area) else null end,
      case when p_venue_mode = 'off_platform' then btrim(p_venue_address) else null end
    ) returning * into v_row;
  end if;

  return v_row;
end;
$$;

grant execute on function save_squad_recurring_template(
  uuid, uuid, int, int, int, int, int, bigint, boolean, text, uuid, text, text, text
) to authenticated;

create or replace function toggle_squad_recurring_template_enabled(p_template_id uuid)
returns squad_recurring_templates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row squad_recurring_templates%rowtype;
begin
  if v_user is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into v_row from squad_recurring_templates where id = p_template_id;
  if not found then raise exception 'template not found' using errcode = 'P0002'; end if;
  if not is_squad_owner(v_row.squad_id, v_user) then raise exception 'owner access required' using errcode = '42501'; end if;

  update squad_recurring_templates set enabled = not enabled where id = p_template_id returning * into v_row;
  return v_row;
end;
$$;

grant execute on function toggle_squad_recurring_template_enabled(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Cron-only: turns a template into this week's game. Not auth.uid()-gated
-- since the cron runs as service_role with no user session — same reason
-- expire_external_slot_payment_intents() (0063) is service_role-only rather
-- than reusing a player-facing RPC.

create or replace function create_squad_recurring_game(
  p_template_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template squad_recurring_templates%rowtype;
  v_squad squads%rowtype;
  v_slot slots%rowtype;
  v_game games%rowtype;
  v_slug text;
  v_fee bigint;
  v_total bigint;
  v_balance bigint;
  v_ref text;
begin
  select * into v_game from games
   where recurring_template_id = p_template_id and lower(during) = p_starts_at
   limit 1;
  if found then return v_game; end if;

  select * into v_template from squad_recurring_templates where id = p_template_id;
  if not found then raise exception 'template not found' using errcode = 'P0002'; end if;
  select * into v_squad from squads where id = v_template.squad_id;
  if not found then raise exception 'squad not found' using errcode = 'P0002'; end if;

  v_slug := lower(regexp_replace(v_squad.name, '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || substr(md5(random()::text), 1, 6);

  if v_template.venue_mode = 'pitch' then
    select * into v_slot from slots
     where pitch_id = v_template.pitch_id
       and during = tstzrange(p_starts_at, p_ends_at)
       and status = 'open'
     for update;
    if not found then
      raise exception 'no open slot this week' using errcode = 'P0001';
    end if;

    v_fee := round(v_slot.price_kobo * 0.05);
    v_total := v_slot.price_kobo + v_fee;
    insert into wallets (user_id, balance_kobo) values (v_squad.owner_id, 0) on conflict (user_id) do nothing;
    select balance_kobo into v_balance from wallets where user_id = v_squad.owner_id for update;
    if v_balance < v_total then
      raise exception 'insufficient wallet balance to reserve this week''s pitch' using errcode = 'P0001';
    end if;

    update wallets set balance_kobo = balance_kobo - v_total, updated_at = now() where user_id = v_squad.owner_id;
    update slots set status = 'booked' where id = v_slot.id;

    insert into games (
      slug, pitch_id, host_id, title, description, level, during, capacity, minimum_to_guarantee,
      price_per_player_kobo, status, bibs_provided, host_paid_kobo, host_reimbursed_kobo,
      minimum_decision_deadline, minimum_decision_status, squad_id, recurring_template_id
    ) values (
      v_slug, v_template.pitch_id, v_squad.owner_id, v_squad.name || ' weekly game', '', 'casual',
      tstzrange(p_starts_at, p_ends_at), v_template.capacity, v_template.minimum_to_guarantee,
      v_template.price_per_player_kobo, 'open', v_template.bibs_provided, v_total, 0,
      greatest(now(), p_starts_at - interval '6 hours'),
      case when 1 >= v_template.minimum_to_guarantee then 'not_needed' else 'pending' end,
      v_squad.id, v_template.id
    ) returning * into v_game;

    v_ref := 'HST-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, game_id)
    values (v_squad.owner_id, 'host_game_deposit', 'completed', -v_total, v_balance - v_total, v_ref, v_game.id);
  else
    insert into games (
      slug, pitch_id, host_id, title, description, level, during, capacity, minimum_to_guarantee,
      price_per_player_kobo, status, bibs_provided, host_paid_kobo, host_reimbursed_kobo,
      minimum_decision_deadline, minimum_decision_status, squad_id, recurring_template_id,
      venue_name, venue_area, venue_address
    ) values (
      v_slug, null, v_squad.owner_id, v_squad.name || ' weekly game', '', 'casual',
      tstzrange(p_starts_at, p_ends_at), v_template.capacity, v_template.minimum_to_guarantee,
      v_template.price_per_player_kobo, 'open', v_template.bibs_provided, 0, 0,
      greatest(now(), p_starts_at - interval '6 hours'),
      case when 1 >= v_template.minimum_to_guarantee then 'not_needed' else 'pending' end,
      v_squad.id, v_template.id,
      v_template.venue_name, v_template.venue_area, v_template.venue_address
    ) returning * into v_game;
  end if;

  insert into game_participants (game_id, user_id, status, paid_kobo)
  values (v_game.id, v_squad.owner_id, 'confirmed', 0);

  update squad_recurring_templates set last_generated_occurrence = p_starts_at where id = p_template_id;

  return v_game;
end;
$$;

revoke all on function create_squad_recurring_game(uuid, timestamptz, timestamptz) from public, authenticated, anon;
grant execute on function create_squad_recurring_game(uuid, timestamptz, timestamptz) to service_role;

-- ----------------------------------------------------------------------------
-- Notification kinds.

alter table user_notifications drop constraint user_notifications_kind_check;
alter table user_notifications add constraint user_notifications_kind_check
  check (kind in (
    'payment', 'waitlist_promoted', 'host_earnings', 'payout', 'game', 'system', 'booking',
    'reward_earned', 'tier_promoted', 'squad_game_scheduled', 'squad_invite_accepted'
  ));
