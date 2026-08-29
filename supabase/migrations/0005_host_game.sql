-- ============================================================================
-- host_game(): the write-side counterpart to join_game()/leave_game(). Hosting
-- a game touches three tables (games, slots, game_participants) and has to
-- stay consistent even under concurrent requests, so — same reasoning as
-- join_game — it's one SECURITY DEFINER function doing a row-locked,
-- all-or-nothing transaction, not three separate client-side calls.
-- ============================================================================

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

grant execute on function host_game(uuid, text, text, skill_level, int, int, bigint, boolean)
  to authenticated;
