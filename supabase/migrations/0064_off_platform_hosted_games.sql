-- Off-platform hosted games.
--
-- A host can now publish a game at a venue that isn't on Tempo at all.
-- There is no pitch to lock and no deposit to collect, since Tempo has no
-- commercial relationship with that venue and isn't reserving anything —
-- the host is solely responsible for having the venue booked. Player
-- payments still flow through Tempo exactly as for any other hosted game,
-- and settle_game_host_reimbursement() (0036) already pays out 100% of
-- what's collected as host earnings once host_pitch_cost_kobo is 0, so no
-- new money math is needed for the "host keeps everything" decision.

alter table games alter column pitch_id drop not null;

alter table games
  add column if not exists venue_name text,
  add column if not exists venue_area text,
  add column if not exists venue_address text;

alter table games
  add constraint games_venue_source_xor
  check ((pitch_id is not null) <> (venue_name is not null));

-- ----------------------------------------------------------------------------
-- host_off_platform_game(): same shape as host_game()/0025's funded flow,
-- minus the slot lock and host deposit — there is no Tempo pitch to reserve.

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
  p_ends_at timestamptz
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

  v_slug := lower(regexp_replace(p_title, '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || substr(md5(random()::text), 1, 6);

  insert into games (
    slug, pitch_id, host_id, title, description, level, during,
    capacity, minimum_to_guarantee, price_per_player_kobo, status,
    bibs_provided, host_paid_kobo, host_reimbursed_kobo,
    minimum_decision_deadline, minimum_decision_status,
    venue_name, venue_area, venue_address
  ) values (
    v_slug, null, v_user, p_title, coalesce(p_description, ''), p_level,
    tstzrange(p_starts_at, p_ends_at), p_capacity, p_minimum_to_guarantee,
    p_price_per_player_kobo, 'open', p_bibs_provided, 0, 0,
    greatest(now(), p_starts_at - interval '6 hours'),
    case when 1 >= p_minimum_to_guarantee then 'not_needed' else 'pending' end,
    v_venue_name, v_venue_area, v_venue_address
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
  text, text, skill_level, int, int, bigint, boolean, text, text, text, timestamptz, timestamptz
) to authenticated;
