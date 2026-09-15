-- ============================================================================
-- Verified attendance and official slot-transfer foundation.
--
-- This turns the existing checked_in_at/no_show fields into a controlled
-- backend workflow: session codes, audit logs, host/venue/admin check-in, and
-- official player replacement through Tempo instead of name-swapping at venue.
-- ============================================================================

create type attendance_session_type as enum ('booking', 'game');
create type attendance_event_type as enum (
  'checked_in',
  'late',
  'no_show',
  'flagged',
  'replaced',
  'walk_on_pending_booking'
);
create type game_slot_transfer_status as enum ('open', 'accepted', 'cancelled', 'expired');

alter table bookings
  add column if not exists check_in_code text,
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by uuid references profiles(id) on delete set null,
  add column if not exists attendance_status text not null default 'booked'
    check (attendance_status in ('booked', 'checked_in', 'late', 'no_show', 'flagged')),
  add column if not exists attendance_note text;

alter table game_participants
  add column if not exists checked_in_by uuid references profiles(id) on delete set null,
  add column if not exists attendance_status text not null default 'booked'
    check (attendance_status in ('booked', 'checked_in', 'late', 'no_show', 'flagged', 'replaced')),
  add column if not exists attendance_note text;

update bookings
   set check_in_code = 'BKG-' || upper(substr(md5(id::text || random()::text), 1, 8))
 where check_in_code is null;

alter table bookings
  alter column check_in_code set not null,
  alter column check_in_code set default ('BKG-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)));

create unique index if not exists bookings_check_in_code_unique on bookings (check_in_code);

create table game_participant_check_in_codes (
  participant_id uuid primary key references game_participants(id) on delete cascade,
  game_id uuid not null references games(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  code text unique not null default ('GME-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8))),
  created_at timestamptz not null default now()
);

insert into game_participant_check_in_codes (participant_id, game_id, user_id)
select id, game_id, user_id
  from game_participants
on conflict (participant_id) do nothing;

create index game_participant_check_in_codes_game_idx
  on game_participant_check_in_codes (game_id, user_id);

create table session_attendance_logs (
  id uuid primary key default uuid_generate_v4(),
  session_type attendance_session_type not null,
  booking_id uuid references bookings(id) on delete cascade,
  participant_id uuid references game_participants(id) on delete cascade,
  game_id uuid references games(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  target_user_id uuid references profiles(id) on delete set null,
  event_type attendance_event_type not null,
  minutes_late int,
  note text,
  created_at timestamptz not null default now(),

  constraint attendance_log_target check (
    (session_type = 'booking' and booking_id is not null and participant_id is null)
    or
    (session_type = 'game' and participant_id is not null and booking_id is null)
  )
);

create index session_attendance_logs_game_idx on session_attendance_logs (game_id, created_at desc);
create index session_attendance_logs_booking_idx on session_attendance_logs (booking_id, created_at desc);
create index session_attendance_logs_actor_idx on session_attendance_logs (actor_id, created_at desc);

create table game_slot_transfer_offers (
  id uuid primary key default uuid_generate_v4(),
  game_id uuid not null references games(id) on delete cascade,
  from_participant_id uuid not null references game_participants(id) on delete cascade,
  from_user_id uuid not null references profiles(id) on delete cascade,
  to_user_id uuid references profiles(id) on delete set null,
  code text unique not null default ('TRF-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8))),
  status game_slot_transfer_status not null default 'open',
  expires_at timestamptz not null,
  accepted_by uuid references profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index game_slot_transfer_open_unique
  on game_slot_transfer_offers (from_participant_id)
  where status = 'open';

create index game_slot_transfer_game_idx on game_slot_transfer_offers (game_id, status, expires_at);

alter table session_attendance_logs enable row level security;
alter table game_slot_transfer_offers enable row level security;
alter table game_participant_check_in_codes enable row level security;

create policy game_check_in_codes_read_parties on game_participant_check_in_codes
  for select using (
    user_id = auth.uid()
    or is_admin()
    or exists (
      select 1 from games g
       where g.id = game_participant_check_in_codes.game_id
         and g.host_id = auth.uid()
    )
    or exists (
      select 1 from games g
      join pitches p on p.id = g.pitch_id
      join venues v on v.id = p.venue_id
       where g.id = game_participant_check_in_codes.game_id
         and v.owner_id = auth.uid()
    )
  );

create policy attendance_logs_read_parties on session_attendance_logs
  for select using (
    is_admin()
    or actor_id = auth.uid()
    or target_user_id = auth.uid()
    or exists (
      select 1 from games g
       where g.id = session_attendance_logs.game_id
         and g.host_id = auth.uid()
    )
    or exists (
      select 1 from bookings b
      join slots s on s.id = b.slot_id
      join pitches p on p.id = s.pitch_id
      join venues v on v.id = p.venue_id
       where b.id = session_attendance_logs.booking_id
         and v.owner_id = auth.uid()
    )
  );

create policy transfer_offers_read_parties on game_slot_transfer_offers
  for select using (
    is_admin()
    or from_user_id = auth.uid()
    or to_user_id = auth.uid()
    or accepted_by = auth.uid()
    or exists (
      select 1 from games g
       where g.id = game_slot_transfer_offers.game_id
         and g.host_id = auth.uid()
    )
  );

create or replace function can_manage_game_attendance(p_game_id uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from games g
      join pitches p on p.id = g.pitch_id
      join venues v on v.id = p.venue_id
     where g.id = p_game_id
       and (g.host_id = p_user or v.owner_id = p_user or is_admin())
  );
$$;

revoke all on function can_manage_game_attendance(uuid, uuid) from public;
revoke all on function can_manage_game_attendance(uuid, uuid) from authenticated;
revoke all on function can_manage_game_attendance(uuid, uuid) from anon;

create or replace function can_manage_booking_attendance(p_booking_id uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from bookings b
      join slots s on s.id = b.slot_id
      join pitches p on p.id = s.pitch_id
      join venues v on v.id = p.venue_id
     where b.id = p_booking_id
       and (v.owner_id = p_user or is_admin())
  );
$$;

revoke all on function can_manage_booking_attendance(uuid, uuid) from public;
revoke all on function can_manage_booking_attendance(uuid, uuid) from authenticated;
revoke all on function can_manage_booking_attendance(uuid, uuid) from anon;

create or replace function ensure_game_check_in_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into game_participant_check_in_codes (participant_id, game_id, user_id)
  values (new.id, new.game_id, new.user_id)
  on conflict (participant_id) do nothing;
  return new;
end;
$$;

drop trigger if exists game_participant_check_in_code_insert on game_participants;
create trigger game_participant_check_in_code_insert
after insert on game_participants
for each row execute function ensure_game_check_in_code();

revoke all on function ensure_game_check_in_code() from public;
revoke all on function ensure_game_check_in_code() from authenticated;
revoke all on function ensure_game_check_in_code() from anon;

create or replace function mark_game_attendance(
  p_participant_id uuid,
  p_event attendance_event_type,
  p_minutes_late int default null,
  p_note text default null,
  p_check_in_code text default null
)
returns game_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_participant game_participants%rowtype;
  v_game games%rowtype;
  v_token text;
  v_status participant_status;
  v_attendance text;
begin
  if v_actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_event not in ('checked_in', 'late', 'no_show', 'flagged') then
    raise exception 'unsupported attendance event' using errcode = 'P0001';
  end if;

  select * into v_participant from game_participants where id = p_participant_id for update;
  if not found then
    raise exception 'participant not found' using errcode = 'P0002';
  end if;

  select * into v_game from games where id = v_participant.game_id for update;
  if not found then
    raise exception 'game not found' using errcode = 'P0002';
  end if;

  if not can_manage_game_attendance(v_game.id, v_actor) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select code into v_token
    from game_participant_check_in_codes
   where participant_id = v_participant.id;

  if p_check_in_code is not null and upper(trim(p_check_in_code)) <> upper(v_token) then
    raise exception 'invalid check-in code' using errcode = 'P0001';
  end if;

  if v_participant.status not in ('confirmed', 'played', 'no_show') then
    raise exception 'participant cannot be checked in' using errcode = 'P0001';
  end if;

  v_status := case
    when p_event = 'no_show' then 'no_show'::participant_status
    when p_event in ('checked_in', 'late') and upper(v_game.during) <= now() then 'played'::participant_status
    else v_participant.status
  end;

  v_attendance := case
    when p_event = 'checked_in' then 'checked_in'
    when p_event = 'late' then 'late'
    when p_event = 'no_show' then 'no_show'
    else 'flagged'
  end;

  update game_participants
     set status = v_status,
         checked_in_at = case when p_event in ('checked_in', 'late') then coalesce(checked_in_at, now()) else checked_in_at end,
         checked_in_by = case when p_event in ('checked_in', 'late') then v_actor else checked_in_by end,
         minutes_late = case when p_event = 'late' then greatest(0, coalesce(p_minutes_late, 0)) else minutes_late end,
         attendance_status = v_attendance,
         attendance_note = nullif(p_note, '')
   where id = p_participant_id
   returning * into v_participant;

  insert into session_attendance_logs (
    session_type, participant_id, game_id, actor_id, target_user_id,
    event_type, minutes_late, note
  ) values (
    'game', v_participant.id, v_participant.game_id, v_actor, v_participant.user_id,
    p_event, case when p_event = 'late' then greatest(0, coalesce(p_minutes_late, 0)) else null end, nullif(p_note, '')
  );

  if v_status in ('played', 'no_show') then
    perform update_player_reputation(v_participant.user_id);
  end if;

  return v_participant;
end;
$$;

grant execute on function mark_game_attendance(uuid, attendance_event_type, int, text, text) to authenticated;

create or replace function mark_booking_attendance(
  p_booking_id uuid,
  p_event attendance_event_type,
  p_minutes_late int default null,
  p_note text default null,
  p_check_in_code text default null
)
returns bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_booking bookings%rowtype;
  v_slot slots%rowtype;
  v_attendance text;
begin
  if v_actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_event not in ('checked_in', 'late', 'no_show', 'flagged') then
    raise exception 'unsupported attendance event' using errcode = 'P0001';
  end if;

  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;

  select * into v_slot from slots where id = v_booking.slot_id;

  if not can_manage_booking_attendance(v_booking.id, v_actor) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_check_in_code is not null and upper(trim(p_check_in_code)) <> upper(v_booking.check_in_code) then
    raise exception 'invalid check-in code' using errcode = 'P0001';
  end if;

  v_attendance := case
    when p_event = 'checked_in' then 'checked_in'
    when p_event = 'late' then 'late'
    when p_event = 'no_show' then 'no_show'
    else 'flagged'
  end;

  update bookings
     set status = case when p_event in ('checked_in', 'late') and upper(v_slot.during) <= now() then 'completed' else status end,
         checked_in_at = case when p_event in ('checked_in', 'late') then coalesce(checked_in_at, now()) else checked_in_at end,
         checked_in_by = case when p_event in ('checked_in', 'late') then v_actor else checked_in_by end,
         attendance_status = v_attendance,
         attendance_note = nullif(p_note, '')
   where id = p_booking_id
   returning * into v_booking;

  insert into session_attendance_logs (
    session_type, booking_id, actor_id, target_user_id,
    event_type, minutes_late, note
  ) values (
    'booking', v_booking.id, v_actor, v_booking.user_id,
    p_event, case when p_event = 'late' then greatest(0, coalesce(p_minutes_late, 0)) else null end, nullif(p_note, '')
  );

  return v_booking;
end;
$$;

grant execute on function mark_booking_attendance(uuid, attendance_event_type, int, text, text) to authenticated;

create or replace function offer_game_slot_transfer(p_game_id uuid)
returns game_slot_transfer_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_game games%rowtype;
  v_participant game_participants%rowtype;
  v_offer game_slot_transfer_offers%rowtype;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_game from games where id = p_game_id for update;
  if not found then
    raise exception 'game not found' using errcode = 'P0002';
  end if;
  if v_game.status not in ('open', 'locked') or lower(v_game.during) <= now() then
    raise exception 'game is no longer transferable' using errcode = 'P0001';
  end if;
  if lower(v_game.during) - interval '2 hours' <= now() then
    raise exception 'transfers have closed for this game' using errcode = 'P0001';
  end if;

  select * into v_participant
    from game_participants
   where game_id = p_game_id
     and user_id = v_user
     and status = 'confirmed'
   for update;

  if not found then
    raise exception 'only confirmed players can offer a spot' using errcode = 'P0001';
  end if;
  if v_game.host_id = v_user then
    raise exception 'hosts cannot transfer the host spot' using errcode = 'P0001';
  end if;
  if v_participant.paid_kobo < v_game.price_per_player_kobo then
    raise exception 'spot must be fully paid before transfer' using errcode = 'P0001';
  end if;

  update game_slot_transfer_offers
     set status = 'expired',
         updated_at = now()
   where from_participant_id = v_participant.id
     and status = 'open'
     and expires_at <= now();

  insert into game_slot_transfer_offers (
    game_id, from_participant_id, from_user_id, expires_at
  ) values (
    p_game_id, v_participant.id, v_user,
    least(lower(v_game.during) - interval '2 hours', now() + interval '24 hours')
  )
  on conflict (from_participant_id) where status = 'open'
  do update set updated_at = now()
  returning * into v_offer;

  return v_offer;
end;
$$;

grant execute on function offer_game_slot_transfer(uuid) to authenticated;

create or replace function cancel_game_slot_transfer(p_offer_id uuid)
returns game_slot_transfer_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_offer game_slot_transfer_offers%rowtype;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_offer from game_slot_transfer_offers where id = p_offer_id for update;
  if not found then
    raise exception 'transfer offer not found' using errcode = 'P0002';
  end if;
  if v_offer.from_user_id <> v_user and not is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v_offer.status <> 'open' then
    return v_offer;
  end if;

  update game_slot_transfer_offers
     set status = 'cancelled',
         updated_at = now()
   where id = p_offer_id
   returning * into v_offer;

  return v_offer;
end;
$$;

grant execute on function cancel_game_slot_transfer(uuid) to authenticated;

create or replace function accept_game_slot_transfer(p_code text)
returns game_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_offer game_slot_transfer_offers%rowtype;
  v_game games%rowtype;
  v_from game_participants%rowtype;
  v_existing game_participants%rowtype;
  v_has_existing boolean := false;
  v_balance bigint;
  v_ref text;
  v_participant game_participants%rowtype;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if exists (select 1 from profiles where id = v_user and suspended) then
    raise exception 'account suspended' using errcode = '42501';
  end if;

  select * into v_offer
    from game_slot_transfer_offers
   where upper(code) = upper(trim(p_code))
   for update;

  if not found then
    raise exception 'transfer offer not found' using errcode = 'P0002';
  end if;
  if v_offer.status <> 'open' or v_offer.expires_at <= now() then
    update game_slot_transfer_offers set status = 'expired', updated_at = now() where id = v_offer.id and status = 'open';
    raise exception 'transfer offer has expired' using errcode = 'P0001';
  end if;
  if v_offer.from_user_id = v_user then
    raise exception 'you cannot accept your own transfer' using errcode = 'P0001';
  end if;
  if v_offer.to_user_id is not null and v_offer.to_user_id <> v_user then
    raise exception 'transfer offer is for another player' using errcode = '42501';
  end if;

  select * into v_game from games where id = v_offer.game_id for update;
  if not found then
    raise exception 'game not found' using errcode = 'P0002';
  end if;
  if v_game.status not in ('open', 'locked') or lower(v_game.during) <= now() then
    raise exception 'game is no longer transferable' using errcode = 'P0001';
  end if;
  if lower(v_game.during) - interval '2 hours' <= now() then
    update game_slot_transfer_offers set status = 'expired', updated_at = now() where id = v_offer.id and status = 'open';
    raise exception 'transfers have closed for this game' using errcode = 'P0001';
  end if;

  select * into v_from from game_participants where id = v_offer.from_participant_id for update;
  if not found then
    raise exception 'original spot is no longer available' using errcode = 'P0001';
  end if;
  if v_from.status <> 'confirmed' then
    raise exception 'original spot is no longer available' using errcode = 'P0001';
  end if;

  select * into v_existing
    from game_participants
   where game_id = v_game.id and user_id = v_user
   for update;

  v_has_existing := found;

  if v_has_existing and v_existing.status in ('confirmed', 'pending_payment', 'played', 'no_show') then
    raise exception 'you already have a spot in this game' using errcode = 'P0001';
  end if;

  insert into wallets (user_id, balance_kobo) values (v_user, 0)
    on conflict (user_id) do nothing;

  select balance_kobo into v_balance from wallets where user_id = v_user for update;
  if v_balance < v_game.price_per_player_kobo then
    raise exception 'insufficient wallet balance' using errcode = 'P0001';
  end if;

  update wallets
     set balance_kobo = balance_kobo - v_game.price_per_player_kobo,
         updated_at = now()
   where wallets.user_id = v_user;

  v_ref := 'GPY-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

  insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, game_id)
  values (v_user, 'game_payment', 'completed', -v_game.price_per_player_kobo, v_balance - v_game.price_per_player_kobo, v_ref, v_game.id);

  insert into wallets (user_id, balance_kobo) values (v_from.user_id, 0)
    on conflict (user_id) do nothing;

  update wallets
     set balance_kobo = balance_kobo + v_from.paid_kobo,
         updated_at = now()
   where wallets.user_id = v_from.user_id
   returning balance_kobo into v_balance;

  v_ref := 'GRF-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

  insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, game_id)
  values (v_from.user_id, 'game_refund', 'completed', v_from.paid_kobo, v_balance, v_ref, v_game.id);

  update game_participants
     set status = 'withdrawn',
         attendance_status = 'replaced',
         attendance_note = 'Transferred through Tempo',
         payment_deadline = null
   where id = v_from.id;

  if v_has_existing then
    update game_participants
       set status = 'confirmed',
           paid_kobo = v_game.price_per_player_kobo,
           payment_deadline = null,
           joined_at = now(),
           attendance_status = 'booked',
           attendance_note = null
     where id = v_existing.id
     returning * into v_participant;

    update game_participant_check_in_codes
       set code = 'GME-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
           user_id = v_user,
           game_id = v_game.id,
           created_at = now()
     where participant_id = v_existing.id;
  else
    insert into game_participants (game_id, user_id, status, paid_kobo)
    values (v_game.id, v_user, 'confirmed', v_game.price_per_player_kobo)
    returning * into v_participant;
  end if;

  update game_slot_transfer_offers
     set status = 'accepted',
         accepted_by = v_user,
         accepted_at = now(),
         updated_at = now()
   where id = v_offer.id;

  insert into session_attendance_logs (
    session_type, participant_id, game_id, actor_id, target_user_id, event_type, note
  ) values (
    'game', v_from.id, v_game.id, v_user, v_from.user_id, 'replaced',
    'Spot transferred to another Tempo user'
  );

  perform refresh_game_minimum_status(v_game.id);

  return v_participant;
end;
$$;

grant execute on function accept_game_slot_transfer(text) to authenticated;
