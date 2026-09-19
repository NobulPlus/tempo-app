-- Existing-session publishing and host cancellation safeguards.
-- A host can expose only the remaining spaces from a confirmed Tempo booking.

alter table games
  add column if not exists preconfirmed_player_count int not null default 0
    check (preconfirmed_player_count >= 0),
  add column if not exists is_existing_session boolean not null default false;

create unique index if not exists games_booking_id_unique_idx
  on games (booking_id)
  where booking_id is not null;

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

  v_slug := lower(regexp_replace(p_title, '[^a-zA-Z0-9]+', '-', 'g'))
    || '-' || substr(md5(random()::text), 1, 6);

  insert into games (
    slug, pitch_id, host_id, booking_id, title, description, level, during,
    capacity, minimum_to_guarantee, price_per_player_kobo, status, bibs_provided,
    host_paid_kobo, host_reimbursed_kobo, host_pitch_cost_kobo, host_booking_fee_kobo,
    host_earnings_kobo, preconfirmed_player_count, is_existing_session,
    minimum_decision_deadline, minimum_decision_status
  ) values (
    v_slug, v_slot.pitch_id, v_user, v_booking.id, p_title, coalesce(p_description, ''), p_level, v_slot.during,
    p_capacity, p_minimum_to_guarantee, p_price_per_player_kobo, 'open', p_bibs_provided,
    v_booking.total_kobo, 0, v_slot.price_kobo, greatest(0, v_booking.total_kobo - v_slot.price_kobo),
    0, p_preconfirmed_player_count, true,
    greatest(now(), lower(v_slot.during) - interval '6 hours'),
    case when p_preconfirmed_player_count >= p_minimum_to_guarantee then 'not_needed' else 'pending' end
  ) returning * into v_game;

  return v_game;
end;
$$;

grant execute on function publish_existing_session(uuid, text, text, skill_level, int, int, bigint, int, boolean) to authenticated;

-- Payment checkout holds must treat externally confirmed regulars as occupied
-- places. This is intentionally the external-payment version: wallet joins
-- remain available for normal Tempo-created games, while this route is used
-- by the standard KoraPay/Flutterwave checkout.
create or replace function start_external_game_join(p_game_id uuid)
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
  if v_game.status <> 'open' then raise exception 'game is not open' using errcode = 'P0001'; end if;
  if lower(v_game.during) <= now() then raise exception 'game has already started' using errcode = 'P0001'; end if;
  if v_game.host_id = v_user then raise exception 'host is already in this game' using errcode = 'P0001'; end if;
  if exists (select 1 from game_participants where game_id = p_game_id and user_id = v_user and status in ('confirmed', 'pending_payment', 'waitlist', 'played', 'no_show')) then
    raise exception 'already joined this game' using errcode = 'P0001';
  end if;

  select coalesce(v_game.preconfirmed_player_count, 0) + count(*) into v_count
    from game_participants where game_id = p_game_id and status in ('confirmed', 'pending_payment');
  v_status := case when v_count >= v_game.capacity then 'waitlist' when v_game.price_per_player_kobo <= 0 then 'confirmed' else 'pending_payment' end;

  if v_status = 'pending_payment' then
    insert into wallets (user_id, balance_kobo) values (v_user, 0) on conflict (user_id) do nothing;
    select balance_kobo into v_balance from wallets where user_id = v_user for update;
    v_charge := least(v_balance, v_game.price_per_player_kobo);
    if v_charge > 0 then
      update wallets set balance_kobo = balance_kobo - v_charge, updated_at = now() where user_id = v_user;
      v_ref := 'GPY-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, game_id)
      values (v_user, 'game_payment', 'completed', -v_charge, v_balance - v_charge, v_ref, p_game_id);
      if v_charge >= v_game.price_per_player_kobo then v_status := 'confirmed'; end if;
    end if;
  end if;

  insert into game_participants (game_id, user_id, status, paid_kobo, payment_deadline)
  values (p_game_id, v_user, v_status, v_charge,
    case when v_status = 'pending_payment' then least(now() + interval '48 hours', lower(v_game.during) - interval '2 hours') else null end)
  on conflict (game_id, user_id) do update
    set status = excluded.status,
        paid_kobo = excluded.paid_kobo,
        payment_deadline = excluded.payment_deadline
    where game_participants.status = 'withdrawn'
  returning * into v_row;

  if v_status in ('confirmed', 'pending_payment') and v_count + 1 >= v_game.capacity then update games set status = 'locked' where id = p_game_id; end if;
  if v_status in ('confirmed', 'pending_payment') and v_count + 1 >= v_game.minimum_to_guarantee then update games set minimum_decision_status = 'not_needed' where id = p_game_id and minimum_decision_status = 'pending'; end if;
  return v_row;
end;
$$;

-- Hosts cannot cancel a session once 80% of the advertised capacity is full.
-- An admin retains exceptional intervention rights for venue failures, safety
-- incidents and payment disputes.
create or replace function cancel_game_with_summary(p_game_id uuid)
returns table (
  game_status game_status,
  minimum_decision_status text,
  player_refunded_count int,
  player_refunded_kobo bigint,
  host_refunded_kobo bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_game games%rowtype;
  v_player record;
  v_filled int;
  v_balance bigint;
  v_ref text;
  v_player_count int := 0;
  v_player_total bigint := 0;
  v_host_total bigint := 0;
begin
  if v_user is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into v_game from games where id = p_game_id for update;
  if not found then raise exception 'game not found' using errcode = 'P0002'; end if;
  if v_game.host_id <> v_user and not is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  if v_game.status not in ('open', 'locked') or lower(v_game.during) <= now() then raise exception 'game cannot be cancelled' using errcode = 'P0001'; end if;
  select coalesce(v_game.preconfirmed_player_count, 0) + count(*) into v_filled from game_participants where game_id = p_game_id and status in ('confirmed', 'pending_payment');
  if not is_admin() and v_filled * 100 >= v_game.capacity * 80 then
    raise exception 'sessions at 80%% full or above must proceed' using errcode = 'P0001';
  end if;

  update games set status = 'cancelled', minimum_decision_status = 'cancelled' where id = p_game_id;
  if not coalesce(v_game.is_existing_session, false) then
    update slots set status = 'open' where pitch_id = v_game.pitch_id and during = v_game.during and status = 'booked';
    perform cancel_venue_settlement_for_game(p_game_id);
  end if;
  for v_player in select * from game_participants where game_id = p_game_id and status in ('confirmed', 'pending_payment') and paid_kobo > 0 for update loop
    insert into wallets (user_id, balance_kobo) values (v_player.user_id, 0) on conflict (user_id) do nothing;
    update wallets set balance_kobo = balance_kobo + v_player.paid_kobo, updated_at = now() where user_id = v_player.user_id returning balance_kobo into v_balance;
    v_ref := 'GRF-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, game_id) values (v_player.user_id, 'game_refund', 'completed', v_player.paid_kobo, v_balance, v_ref, p_game_id);
    insert into game_cancellation_refunds (game_id, user_id, amount_kobo) values (p_game_id, v_player.user_id, v_player.paid_kobo) on conflict (game_id, user_id) do update set amount_kobo = excluded.amount_kobo, created_at = now(), notified_at = null;
    v_player_count := v_player_count + 1; v_player_total := v_player_total + v_player.paid_kobo;
  end loop;
  update game_participants set status = 'withdrawn', payment_deadline = null where game_id = p_game_id and status in ('confirmed', 'pending_payment', 'waitlist');
  if not coalesce(v_game.is_existing_session, false) and lower(v_game.during) - now() >= interval '6 hours' then
    v_host_total := greatest(0, v_game.host_paid_kobo - v_game.host_reimbursed_kobo);
    if v_host_total > 0 then
      insert into wallets (user_id, balance_kobo) values (v_game.host_id, 0) on conflict (user_id) do nothing;
      update wallets set balance_kobo = balance_kobo + v_host_total, updated_at = now() where user_id = v_game.host_id returning balance_kobo into v_balance;
      v_ref := 'GRF-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, game_id) values (v_game.host_id, 'game_refund', 'completed', v_host_total, v_balance, v_ref, p_game_id);
    end if;
  end if;
  game_status := 'cancelled'; minimum_decision_status := 'cancelled'; player_refunded_count := v_player_count; player_refunded_kobo := v_player_total; host_refunded_kobo := v_host_total;
  return next;
end;
$$;

grant execute on function cancel_game_with_summary(uuid) to authenticated;
