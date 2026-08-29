-- ============================================================================
-- Fixes three bugs found in a live-readiness audit, all in the SECURITY
-- DEFINER functions from 0001_init.sql / 0005_host_game.sql:
--
-- 1. join_game() rejected any game whose status wasn't 'open' — but the same
--    function sets a game to 'locked' the moment it fills. That meant nobody
--    could ever join the waitlist: the exact players the waitlist exists for
--    were the first ones locked out. Capacity/waitlist status is already
--    derived from the live participant count below, not from game.status, so
--    game.status only needs to gate "is this game still alive at all"
--    (not cancelled/played, not started) — 'locked' should still pass through.
--
-- 2. leave_game() updated the caller's own participant row to 'withdrawn' but
--    never checked whether that UPDATE actually touched a row. A user who was
--    never in the game could call it, match zero rows, and the function would
--    still fall through and promote the first waitlisted player — a
--    non-participant triggering a real seat change for someone else.
--
-- 3. Neither function (nor host_game) checked profiles.suspended, which the
--    schema has carried since 0002_auth_hardening.sql but nothing enforced.
-- ============================================================================

create or replace function join_game(p_game_id uuid)
returns game_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_game   games%rowtype;
  v_count  int;
  v_status participant_status;
  v_row    game_participants%rowtype;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if exists (select 1 from profiles where id = v_user and suspended) then
    raise exception 'account suspended' using errcode = '42501';
  end if;

  -- Lock the game row so concurrent joins serialise here.
  select * into v_game from games where id = p_game_id for update;

  if not found then
    raise exception 'game not found' using errcode = 'P0002';
  end if;
  if v_game.status not in ('open', 'locked') then
    raise exception 'game is not open' using errcode = 'P0001';
  end if;
  if lower(v_game.during) <= now() then
    raise exception 'game has already started' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from game_participants
  where game_id = p_game_id and status = 'confirmed';

  v_status := case when v_count >= v_game.capacity then 'waitlist' else 'confirmed' end;

  insert into game_participants (game_id, user_id, status)
  values (p_game_id, v_user, v_status)
  on conflict (game_id, user_id) do update
    set status = case
                   when game_participants.status = 'withdrawn' then excluded.status
                   else game_participants.status
                 end
  returning * into v_row;

  -- Auto-lock once full
  if v_status = 'confirmed' and v_count + 1 >= v_game.capacity then
    update games set status = 'locked' where id = p_game_id;
  end if;

  return v_row;
end;
$$;

-- Leave a game and promote the first person off the waitlist.
create or replace function leave_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_rows int;
  v_next uuid;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if exists (select 1 from profiles where id = v_user and suspended) then
    raise exception 'account suspended' using errcode = '42501';
  end if;

  update game_participants
     set status = 'withdrawn'
   where game_id = p_game_id and user_id = v_user and status <> 'withdrawn';

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'not a participant in this game' using errcode = 'P0001';
  end if;

  select id into v_next
    from game_participants
   where game_id = p_game_id and status = 'waitlist'
   order by joined_at
   limit 1;

  if v_next is not null then
    update game_participants set status = 'confirmed' where id = v_next;
  else
    update games set status = 'open' where id = p_game_id and status = 'locked';
  end if;
end;
$$;

-- host_game(): same suspended check as join_game/leave_game above.
create or replace function host_game(
  p_slot_id uuid,
  p_title text,
  p_description text,
  p_level skill_level,
  p_capacity int,
  p_minimum_to_guarantee int,
  p_price_per_player_kobo bigint,
  p_bibs_provided boolean
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
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if exists (select 1 from profiles where id = v_user and suspended) then
    raise exception 'account suspended' using errcode = '42501';
  end if;

  -- Lock the slot so two hosts can't both claim it.
  select * into v_slot from slots where id = p_slot_id for update;
  if not found then
    raise exception 'slot not found' using errcode = 'P0002';
  end if;
  if v_slot.status <> 'open' then
    raise exception 'slot is no longer available' using errcode = 'P0001';
  end if;

  v_slug := lower(regexp_replace(p_title, '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || substr(md5(random()::text), 1, 6);

  insert into games (
    slug, pitch_id, host_id, title, description, level, during,
    capacity, minimum_to_guarantee, price_per_player_kobo, status, bibs_provided
  ) values (
    v_slug, v_slot.pitch_id, v_user, p_title, coalesce(p_description, ''), p_level,
    v_slot.during, p_capacity, p_minimum_to_guarantee, p_price_per_player_kobo,
    'open', p_bibs_provided
  )
  returning * into v_game;

  update slots set status = 'booked' where id = p_slot_id;

  -- The host is automatically the first confirmed player.
  insert into game_participants (game_id, user_id, status)
  values (v_game.id, v_user, 'confirmed');

  return v_game;
end;
$$;
