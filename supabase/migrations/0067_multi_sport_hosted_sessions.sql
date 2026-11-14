-- Multi-sport hosted sessions.
--
-- Venues/pitches already carry an activity_type (0031, 0032) — hosted games
-- never did, so every session read as implicitly football regardless of
-- what court it was actually on. Games now carry the same field: inherited
-- from the pitch (never trusted from the client) when hosting on a real
-- Tempo pitch, chosen by the host when hosting off-platform.
--
-- This also extends "block some spots for my own team, publish the rest"
-- (games.preconfirmed_player_count, 0038) to host_game() and
-- host_off_platform_game() — publish_existing_session() already had it.
-- Every downstream function (join_game, promote_next_waitlisted,
-- refresh_game_minimum_status, decide_game_minimum, all fixed together in
-- 0039) already reads preconfirmed_player_count generically, so only the
-- three creation paths need to change.

alter table games
  add column if not exists activity_type text not null default 'football';

alter table games
  add constraint games_activity_type_not_blank
  check (length(btrim(activity_type)) > 0);

-- ----------------------------------------------------------------------------
-- host_game(): activity_type inherited from the pitch; preconfirmed_player_count
-- here means "other players already confirmed, not counting the host" — the
-- host still gets their own game_participants row below, same as before.
--
-- Adding a parameter changes the function's signature, so `create or
-- replace` would leave the old 8-arg overload behind instead of replacing
-- it (Postgres identifies a function by name + parameter types, not by
-- whether a trailing parameter has a default) — drop it explicitly first.
drop function if exists host_game(uuid, text, text, skill_level, int, int, bigint, boolean);

create or replace function host_game(
  p_slot_id uuid,
  p_title text,
  p_description text,
  p_level skill_level,
  p_capacity int,
  p_minimum_to_guarantee int,
  p_price_per_player_kobo bigint,
  p_bibs_provided boolean,
  p_preconfirmed_player_count int default 0
)
returns games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_slot slots%rowtype;
  v_game games%rowtype;
  v_slug text;
  v_fee bigint;
  v_total bigint;
  v_balance bigint;
  v_ref text;
  v_activity_type text;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if exists (select 1 from profiles where id = v_user and suspended) then
    raise exception 'account suspended' using errcode = '42501';
  end if;

  if p_minimum_to_guarantee > p_capacity then
    raise exception 'minimum cannot exceed capacity' using errcode = 'P0001';
  end if;
  if p_preconfirmed_player_count < 0 or p_preconfirmed_player_count > p_capacity - 1 then
    raise exception 'invalid player counts' using errcode = 'P0001';
  end if;

  select * into v_slot from slots where id = p_slot_id for update;
  if not found then
    raise exception 'slot not found' using errcode = 'P0002';
  end if;
  if v_slot.status <> 'open' then
    raise exception 'slot is no longer available' using errcode = 'P0001';
  end if;
  if lower(v_slot.during) <= now() then
    raise exception 'that time has already passed' using errcode = 'P0001';
  end if;

  select activity_type into v_activity_type from pitches where id = v_slot.pitch_id;

  v_fee := round(v_slot.price_kobo * 0.05);
  v_total := v_slot.price_kobo + v_fee;

  insert into wallets (user_id, balance_kobo) values (v_user, 0)
    on conflict (user_id) do nothing;

  select balance_kobo into v_balance from wallets where user_id = v_user for update;
  if v_balance < v_total then
    raise exception 'insufficient wallet balance to reserve this pitch' using errcode = 'P0001';
  end if;

  update wallets
     set balance_kobo = balance_kobo - v_total, updated_at = now()
   where user_id = v_user;

  v_slug := lower(regexp_replace(p_title, '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || substr(md5(random()::text), 1, 6);

  insert into games (
    slug, pitch_id, host_id, title, description, level, during,
    capacity, minimum_to_guarantee, price_per_player_kobo, status,
    bibs_provided, host_paid_kobo, host_reimbursed_kobo,
    minimum_decision_deadline, minimum_decision_status,
    preconfirmed_player_count, activity_type
  ) values (
    v_slug, v_slot.pitch_id, v_user, p_title, coalesce(p_description, ''), p_level,
    v_slot.during, p_capacity, p_minimum_to_guarantee, p_price_per_player_kobo,
    'open', p_bibs_provided, v_total, 0,
    greatest(now(), lower(v_slot.during) - interval '6 hours'),
    case when (1 + p_preconfirmed_player_count) >= p_minimum_to_guarantee then 'not_needed' else 'pending' end,
    p_preconfirmed_player_count, coalesce(v_activity_type, 'football')
  )
  returning * into v_game;

  v_ref := 'HST-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

  insert into wallet_transactions (
    user_id, type, status, amount_kobo, balance_after_kobo, reference, game_id
  ) values (
    v_user, 'host_game_deposit', 'completed', -v_total, v_balance - v_total,
    v_ref, v_game.id
  );

  update slots set status = 'booked' where id = p_slot_id;

  -- Host counts as the first confirmed player, but does not pay the per-player
  -- join price because they already funded the venue reservation.
  insert into game_participants (game_id, user_id, status, paid_kobo)
  values (v_game.id, v_user, 'confirmed', 0);

  return v_game;
end;
$$;

grant execute on function host_game(uuid, text, text, skill_level, int, int, bigint, boolean, int) to authenticated;

-- ----------------------------------------------------------------------------
-- publish_existing_session(): same preconfirmed param it already had, now
-- also inherits activity_type from the booking's pitch.

create or replace function publish_existing_session(
  p_booking_id uuid,
  p_title text,
  p_description text,
  p_level skill_level,
  p_capacity int,
  p_minimum_to_guarantee int,
  p_price_per_player_kobo bigint,
  p_preconfirmed_player_count int,
  p_bibs_provided boolean
)
returns games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_booking bookings%rowtype;
  v_slot slots%rowtype;
  v_game games%rowtype;
  v_slug text;
  v_activity_type text;
begin
  if v_user is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if exists (select 1 from profiles where id = v_user and suspended) then
    raise exception 'account suspended' using errcode = '42501';
  end if;
  if p_capacity < 2 or p_capacity > 30 or p_preconfirmed_player_count < 1
     or p_preconfirmed_player_count >= p_capacity then
    raise exception 'invalid player counts' using errcode = 'P0001';
  end if;
  if p_minimum_to_guarantee < 2 or p_minimum_to_guarantee > p_capacity then
    raise exception 'minimum cannot exceed capacity' using errcode = 'P0001';
  end if;

  select * into v_booking from bookings
   where id = p_booking_id and user_id = v_user
   for update;
  if not found or v_booking.status <> 'confirmed' then
    raise exception 'confirmed booking not found' using errcode = 'P0002';
  end if;
  if exists (select 1 from games where booking_id = p_booking_id) then
    raise exception 'this booking is already published as a game' using errcode = 'P0001';
  end if;
  select * into v_slot from slots where id = v_booking.slot_id for update;
  if not found or lower(v_slot.during) <= now() then
    raise exception 'booking is no longer eligible to publish' using errcode = 'P0001';
  end if;

  select activity_type into v_activity_type from pitches where id = v_slot.pitch_id;

  v_slug := lower(regexp_replace(p_title, '[^a-zA-Z0-9]+', '-', 'g'))
    || '-' || substr(md5(random()::text), 1, 6);

  insert into games (
    slug, pitch_id, host_id, booking_id, title, description, level, during,
    capacity, minimum_to_guarantee, price_per_player_kobo, status, bibs_provided,
    host_paid_kobo, host_reimbursed_kobo, host_pitch_cost_kobo, host_booking_fee_kobo,
    host_earnings_kobo, preconfirmed_player_count, is_existing_session,
    minimum_decision_deadline, minimum_decision_status, activity_type
  ) values (
    v_slug, v_slot.pitch_id, v_user, v_booking.id, p_title, coalesce(p_description, ''), p_level, v_slot.during,
    p_capacity, p_minimum_to_guarantee, p_price_per_player_kobo, 'open', p_bibs_provided,
    v_booking.total_kobo, 0, v_slot.price_kobo, greatest(0, v_booking.total_kobo - v_slot.price_kobo),
    0, p_preconfirmed_player_count, true,
    greatest(now(), lower(v_slot.during) - interval '6 hours'),
    case when p_preconfirmed_player_count >= p_minimum_to_guarantee then 'not_needed' else 'pending' end,
    coalesce(v_activity_type, 'football')
  ) returning * into v_game;

  return v_game;
end;
$$;

grant execute on function publish_existing_session(uuid, text, text, skill_level, int, int, bigint, int, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- host_off_platform_game(): host picks the sport directly (no pitch to
-- inherit from); same "not counting the host" preconfirmed semantics as
-- host_game() above, since the host also gets their own participant row.
-- Same signature-change reasoning as host_game() above — drop the old
-- 12-arg overload before defining the 14-arg version.
drop function if exists host_off_platform_game(
  text, text, skill_level, int, int, bigint, boolean, text, text, text, timestamptz, timestamptz
);

create or replace function host_off_platform_game(
  p_title text,
  p_description text,
  p_level skill_level,
  p_capacity int,
  p_minimum_to_guarantee int,
  p_price_per_player_kobo bigint,
  p_bibs_provided boolean,
  p_venue_name text,
  p_venue_area text,
  p_venue_address text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_activity_type text default 'football',
  p_preconfirmed_player_count int default 0
)
returns games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_game games%rowtype;
  v_slug text;
  v_venue_name text := btrim(coalesce(p_venue_name, ''));
  v_venue_area text := btrim(coalesce(p_venue_area, ''));
  v_venue_address text := btrim(coalesce(p_venue_address, ''));
  v_activity_type text := btrim(coalesce(p_activity_type, 'football'));
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from profiles where id = v_user and suspended) then
    raise exception 'account suspended' using errcode = '42501';
  end if;

  if p_minimum_to_guarantee > p_capacity then
    raise exception 'minimum cannot exceed capacity' using errcode = 'P0001';
  end if;
  if p_preconfirmed_player_count < 0 or p_preconfirmed_player_count > p_capacity - 1 then
    raise exception 'invalid player counts' using errcode = 'P0001';
  end if;
  if p_starts_at <= now() then
    raise exception 'that time has already passed' using errcode = 'P0001';
  end if;
  if p_ends_at <= p_starts_at then
    raise exception 'end time must be after the start time' using errcode = 'P0001';
  end if;
  if p_ends_at - p_starts_at > interval '4 hours' then
    raise exception 'a hosted session cannot be longer than 4 hours' using errcode = 'P0001';
  end if;
  if length(v_venue_name) not between 2 and 120 then
    raise exception 'enter the venue name' using errcode = 'P0001';
  end if;
  if length(v_venue_area) not between 2 and 60 then
    raise exception 'enter the venue area' using errcode = 'P0001';
  end if;
  if length(v_venue_address) not between 5 and 240 then
    raise exception 'enter the venue address' using errcode = 'P0001';
  end if;
  if length(v_activity_type) = 0 then
    raise exception 'choose a sport' using errcode = 'P0001';
  end if;

  v_slug := lower(regexp_replace(p_title, '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || substr(md5(random()::text), 1, 6);

  insert into games (
    slug, pitch_id, host_id, title, description, level, during,
    capacity, minimum_to_guarantee, price_per_player_kobo, status,
    bibs_provided, host_paid_kobo, host_reimbursed_kobo,
    minimum_decision_deadline, minimum_decision_status,
    venue_name, venue_area, venue_address, preconfirmed_player_count, activity_type
  ) values (
    v_slug, null, v_user, p_title, coalesce(p_description, ''), p_level,
    tstzrange(p_starts_at, p_ends_at), p_capacity, p_minimum_to_guarantee,
    p_price_per_player_kobo, 'open', p_bibs_provided, 0, 0,
    greatest(now(), p_starts_at - interval '6 hours'),
    case when (1 + p_preconfirmed_player_count) >= p_minimum_to_guarantee then 'not_needed' else 'pending' end,
    v_venue_name, v_venue_area, v_venue_address, p_preconfirmed_player_count, v_activity_type
  )
  returning * into v_game;

  -- The host is automatically the first confirmed player. They paid Tempo
  -- nothing to create this game, so there's no deposit to net against.
  insert into game_participants (game_id, user_id, status, paid_kobo)
  values (v_game.id, v_user, 'confirmed', 0);

  return v_game;
end;
$$;

grant execute on function host_off_platform_game(
  text, text, skill_level, int, int, bigint, boolean, text, text, text, timestamptz, timestamptz, text, int
) to authenticated;
