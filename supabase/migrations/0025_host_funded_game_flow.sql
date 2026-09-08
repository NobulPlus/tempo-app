-- ============================================================================
-- Host-funded game flow.
--
-- Product model:
--   1. Host pays the pitch booking cost upfront from wallet when creating a game.
--   2. Players pay Tempo when joining; those payments are escrow-like platform
--      collections, not direct transfers to the host.
--   3. If the game misses minimum, the host/admin decides: go ahead anyway or
--      cancel and refund players.
--   4. Host reimbursement is a separate idempotent settlement step, capped at
--      the host's upfront deposit and never paid before the game is committed.
--
-- The host deposit uses the same 5% service-fee total as direct bookings, so
-- a hosted game reserves the venue with the same economic weight as a normal
-- pitch booking.
-- ============================================================================

alter table games
  add column if not exists host_paid_kobo bigint not null default 0 check (host_paid_kobo >= 0),
  add column if not exists host_reimbursed_kobo bigint not null default 0 check (host_reimbursed_kobo >= 0),
  add column if not exists minimum_decision_deadline timestamptz,
  add column if not exists minimum_decision_status text not null default 'pending'
    check (minimum_decision_status in ('pending', 'go_ahead', 'cancelled', 'not_needed'));

alter table games
  add constraint host_reimbursement_capped
  check (host_reimbursed_kobo <= host_paid_kobo);

-- Mark games that already have enough paid/held participants as not needing a
-- host minimum decision. Existing rows from earlier migrations are left with a
-- zero host deposit because they were created before the host-funded model.
update games g
   set minimum_decision_status = 'not_needed'
 where (
   select count(*)
     from game_participants gp
    where gp.game_id = g.id
      and gp.status in ('confirmed', 'pending_payment')
 ) >= g.minimum_to_guarantee;

-- ----------------------------------------------------------------------------
-- Utility: refresh the minimum decision flag once a game reaches minimum.

create or replace function refresh_game_minimum_status(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game games%rowtype;
  v_count int;
begin
  select * into v_game from games where id = p_game_id for update;
  if not found then
    return;
  end if;

  if v_game.status not in ('open', 'locked') then
    return;
  end if;

  select count(*) into v_count
    from game_participants
   where game_id = p_game_id
     and status in ('confirmed', 'pending_payment');

  if v_count >= v_game.minimum_to_guarantee then
    update games
       set minimum_decision_status = 'not_needed'
     where id = p_game_id
       and minimum_decision_status = 'pending';
  elsif v_game.minimum_decision_status = 'not_needed' then
    update games
       set minimum_decision_status = 'pending'
     where id = p_game_id;
  end if;
end;
$$;

revoke all on function refresh_game_minimum_status(uuid) from public;
revoke all on function refresh_game_minimum_status(uuid) from authenticated;
revoke all on function refresh_game_minimum_status(uuid) from anon;

-- ----------------------------------------------------------------------------
-- Replace host_game(): host now pays upfront to reserve the pitch.

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
  v_fee bigint;
  v_total bigint;
  v_balance bigint;
  v_ref text;
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
    minimum_decision_deadline, minimum_decision_status
  ) values (
    v_slug, v_slot.pitch_id, v_user, p_title, coalesce(p_description, ''), p_level,
    v_slot.during, p_capacity, p_minimum_to_guarantee, p_price_per_player_kobo,
    'open', p_bibs_provided, v_total, 0,
    greatest(now(), lower(v_slot.during) - interval '6 hours'),
    case when 1 >= p_minimum_to_guarantee then 'not_needed' else 'pending' end
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

grant execute on function host_game(uuid, text, text, skill_level, int, int, bigint, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- Replace promote_next_waitlisted() to refresh minimum status after promotion.

create or replace function promote_next_waitlisted(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game    games%rowtype;
  v_next    game_participants%rowtype;
  v_balance bigint;
  v_charge  bigint;
  v_status  participant_status;
  v_ref     text;
begin
  select * into v_game from games where id = p_game_id for update;
  if not found then
    return;
  end if;

  select * into v_next
    from game_participants
   where game_id = p_game_id and status = 'waitlist'
   order by joined_at
   limit 1
   for update;

  if not found then
    update games set status = 'open' where id = p_game_id and status = 'locked';
    return;
  end if;

  v_charge := 0;
  v_status := 'confirmed';

  if v_game.price_per_player_kobo > 0 then
    insert into wallets (user_id, balance_kobo) values (v_next.user_id, 0)
      on conflict (user_id) do nothing;

    select balance_kobo into v_balance from wallets where user_id = v_next.user_id for update;
    v_charge := least(v_balance, v_game.price_per_player_kobo);

    if v_charge > 0 then
      update wallets set balance_kobo = balance_kobo - v_charge, updated_at = now()
        where user_id = v_next.user_id;

      v_ref := 'GPY-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

      insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, game_id)
      values (v_next.user_id, 'game_payment', 'completed', -v_charge, v_balance - v_charge, v_ref, p_game_id);
    end if;

    if v_charge < v_game.price_per_player_kobo then
      v_status := 'pending_payment';
    end if;
  end if;

  update game_participants
     set status = v_status,
         paid_kobo = v_charge,
         payment_deadline = case when v_status = 'pending_payment'
           then least(now() + interval '48 hours', lower(v_game.during) - interval '2 hours')
           else null
         end
   where id = v_next.id;

  perform refresh_game_minimum_status(p_game_id);
end;
$$;

revoke all on function promote_next_waitlisted(uuid) from public;
revoke all on function promote_next_waitlisted(uuid) from authenticated;
revoke all on function promote_next_waitlisted(uuid) from anon;

-- ----------------------------------------------------------------------------
-- Replace join_game() to refresh minimum status once payment/hold lands.

create or replace function join_game(p_game_id uuid)
returns game_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_game    games%rowtype;
  v_count   int;
  v_status  participant_status;
  v_row     game_participants%rowtype;
  v_balance bigint;
  v_charge  bigint := 0;
  v_ref     text;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if exists (select 1 from profiles where id = v_user and suspended) then
    raise exception 'account suspended' using errcode = '42501';
  end if;

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

  if exists (
    select 1 from game_participants
     where game_id = p_game_id and user_id = v_user and status <> 'withdrawn'
  ) then
    raise exception 'already a participant in this game' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from game_participants
  where game_id = p_game_id and status in ('confirmed', 'pending_payment');

  v_status := case when v_count >= v_game.capacity then 'waitlist' else 'confirmed' end;

  if v_status = 'confirmed' and v_game.price_per_player_kobo > 0 then
    insert into wallets (user_id, balance_kobo) values (v_user, 0)
      on conflict (user_id) do nothing;

    select balance_kobo into v_balance from wallets where user_id = v_user for update;
    v_charge := least(v_balance, v_game.price_per_player_kobo);

    if v_charge > 0 then
      update wallets set balance_kobo = balance_kobo - v_charge, updated_at = now()
        where user_id = v_user;

      v_ref := 'GPY-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

      insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, game_id)
      values (v_user, 'game_payment', 'completed', -v_charge, v_balance - v_charge, v_ref, p_game_id);
    end if;

    if v_charge < v_game.price_per_player_kobo then
      v_status := 'pending_payment';
    end if;
  end if;

  insert into game_participants (game_id, user_id, status, paid_kobo, payment_deadline)
  values (
    p_game_id, v_user, v_status, v_charge,
    case when v_status = 'pending_payment'
      then least(now() + interval '48 hours', lower(v_game.during) - interval '2 hours')
      else null
    end
  )
  on conflict (game_id, user_id) do update
    set status = case
                   when game_participants.status = 'withdrawn' then excluded.status
                   else game_participants.status
                 end,
        paid_kobo = case
                   when game_participants.status = 'withdrawn' then excluded.paid_kobo
                   else game_participants.paid_kobo
                 end,
        payment_deadline = case
                   when game_participants.status = 'withdrawn' then excluded.payment_deadline
                   else game_participants.payment_deadline
                 end
  returning * into v_row;

  if v_status in ('confirmed', 'pending_payment') and v_count + 1 >= v_game.capacity then
    update games set status = 'locked' where id = p_game_id;
  end if;

  if v_status in ('confirmed', 'pending_payment') then
    perform refresh_game_minimum_status(p_game_id);
  end if;

  return v_row;
end;
$$;

grant execute on function join_game(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Replace pay_game_balance() to refresh minimum status after a held player
-- completes payment.

create or replace function pay_game_balance(p_game_id uuid)
returns game_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_game      games%rowtype;
  v_row       game_participants%rowtype;
  v_balance   bigint;
  v_remaining bigint;
  v_charge    bigint;
  v_ref       text;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_game from games where id = p_game_id for update;
  if not found then
    raise exception 'game not found' using errcode = 'P0002';
  end if;

  select * into v_row from game_participants
    where game_id = p_game_id and user_id = v_user for update;

  if not found then
    raise exception 'not a participant in this game' using errcode = 'P0001';
  end if;
  if v_row.status <> 'pending_payment' then
    raise exception 'no payment is due' using errcode = 'P0001';
  end if;

  v_remaining := v_game.price_per_player_kobo - v_row.paid_kobo;

  insert into wallets (user_id, balance_kobo) values (v_user, 0)
    on conflict (user_id) do nothing;

  select balance_kobo into v_balance from wallets where user_id = v_user for update;
  v_charge := least(v_balance, v_remaining);

  if v_charge <= 0 then
    raise exception 'insufficient wallet balance' using errcode = 'P0001';
  end if;

  update wallets set balance_kobo = balance_kobo - v_charge, updated_at = now()
    where user_id = v_user;

  v_ref := 'GPY-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

  insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, game_id)
  values (v_user, 'game_payment', 'completed', -v_charge, v_balance - v_charge, v_ref, p_game_id);

  update game_participants
     set paid_kobo = paid_kobo + v_charge,
         status = case when paid_kobo + v_charge >= v_game.price_per_player_kobo then 'confirmed' else status end,
         payment_deadline = case when paid_kobo + v_charge >= v_game.price_per_player_kobo then null else payment_deadline end
   where id = v_row.id
   returning * into v_row;

  perform refresh_game_minimum_status(p_game_id);
  return v_row;
end;
$$;

grant execute on function pay_game_balance(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Replace leave_game() so the host cannot abandon their own funded game; they
-- must use cancel_game()/decide_game_minimum(..., 'cancel') so the pitch,
-- participants and host deposit are handled together.

create or replace function leave_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_game    games%rowtype;
  v_row     game_participants%rowtype;
  v_credit  bigint := 0;
  v_balance bigint;
  v_ref     text;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if exists (select 1 from profiles where id = v_user and suspended) then
    raise exception 'account suspended' using errcode = '42501';
  end if;

  select * into v_game from games where id = p_game_id for update;
  if not found then
    raise exception 'game not found' using errcode = 'P0002';
  end if;
  if v_game.host_id = v_user then
    raise exception 'hosts must cancel the game instead' using errcode = 'P0001';
  end if;

  select * into v_row from game_participants
    where game_id = p_game_id and user_id = v_user and status <> 'withdrawn'
    for update;

  if not found then
    raise exception 'not a participant in this game' using errcode = 'P0001';
  end if;

  update game_participants set status = 'withdrawn' where id = v_row.id;

  if v_row.paid_kobo > 0 and lower(v_game.during) - now() >= interval '6 hours' then
    v_credit := v_row.paid_kobo;

    insert into wallets (user_id, balance_kobo) values (v_user, 0)
      on conflict (user_id) do nothing;

    update wallets set balance_kobo = balance_kobo + v_credit, updated_at = now()
      where user_id = v_user
      returning balance_kobo into v_balance;

    v_ref := 'GRF-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

    insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, game_id)
    values (v_user, 'game_refund', 'completed', v_credit, v_balance, v_ref, p_game_id);
  end if;

  perform promote_next_waitlisted(p_game_id);
  perform refresh_game_minimum_status(p_game_id);
end;
$$;

grant execute on function leave_game(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Shared cancellation implementation. Host deposit refund uses the same
-- 6-hour notice rule as direct pitch bookings. Player refunds are always full
-- when the game itself is cancelled.

create or replace function cancel_game_internal(p_game_id uuid)
returns games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game    games%rowtype;
  v_p       record;
  v_balance bigint;
  v_ref     text;
  v_host_refund bigint;
begin
  select * into v_game from games where id = p_game_id for update;
  if not found then
    raise exception 'game not found' using errcode = 'P0002';
  end if;
  if v_game.status not in ('open', 'locked') then
    raise exception 'game cannot be cancelled' using errcode = 'P0001';
  end if;
  if lower(v_game.during) <= now() then
    raise exception 'game has already started' using errcode = 'P0001';
  end if;

  update games
     set status = 'cancelled',
         minimum_decision_status = 'cancelled'
   where id = p_game_id;

  update slots set status = 'open'
   where pitch_id = v_game.pitch_id and during = v_game.during and status = 'booked';

  for v_p in
    select * from game_participants
     where game_id = p_game_id
       and status in ('confirmed', 'pending_payment')
       and paid_kobo > 0
     for update
  loop
    insert into wallets (user_id, balance_kobo) values (v_p.user_id, 0)
      on conflict (user_id) do nothing;

    update wallets set balance_kobo = balance_kobo + v_p.paid_kobo, updated_at = now()
      where user_id = v_p.user_id
      returning balance_kobo into v_balance;

    v_ref := 'GRF-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

    insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, game_id)
    values (v_p.user_id, 'game_refund', 'completed', v_p.paid_kobo, v_balance, v_ref, p_game_id);
  end loop;

  v_host_refund := greatest(0, v_game.host_paid_kobo - v_game.host_reimbursed_kobo);
  if v_host_refund > 0 and lower(v_game.during) - now() >= interval '6 hours' then
    insert into wallets (user_id, balance_kobo) values (v_game.host_id, 0)
      on conflict (user_id) do nothing;

    update wallets set balance_kobo = balance_kobo + v_host_refund, updated_at = now()
      where user_id = v_game.host_id
      returning balance_kobo into v_balance;

    v_ref := 'GRF-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

    insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, game_id)
    values (v_game.host_id, 'game_refund', 'completed', v_host_refund, v_balance, v_ref, p_game_id);
  end if;

  select * into v_game from games where id = p_game_id;
  return v_game;
end;
$$;

revoke all on function cancel_game_internal(uuid) from public;
revoke all on function cancel_game_internal(uuid) from authenticated;
revoke all on function cancel_game_internal(uuid) from anon;

create or replace function cancel_game(p_game_id uuid)
returns games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_game games%rowtype;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_game from games where id = p_game_id for update;
  if not found then
    raise exception 'game not found' using errcode = 'P0002';
  end if;

  if v_game.host_id <> v_user and not is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return cancel_game_internal(p_game_id);
end;
$$;

grant execute on function cancel_game(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Host/admin decision when minimum has not been reached.

create or replace function decide_game_minimum(p_game_id uuid, p_decision text)
returns games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_game games%rowtype;
  v_count int;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_decision not in ('go_ahead', 'cancel') then
    raise exception 'unknown decision' using errcode = 'P0001';
  end if;

  select * into v_game from games where id = p_game_id for update;
  if not found then
    raise exception 'game not found' using errcode = 'P0002';
  end if;
  if v_game.host_id <> v_user and not is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v_game.status not in ('open', 'locked') then
    raise exception 'game cannot be decided' using errcode = 'P0001';
  end if;
  if lower(v_game.during) <= now() then
    raise exception 'game has already started' using errcode = 'P0001';
  end if;

  select count(*) into v_count
    from game_participants
   where game_id = p_game_id
     and status in ('confirmed', 'pending_payment');

  if v_count >= v_game.minimum_to_guarantee then
    update games set minimum_decision_status = 'not_needed' where id = p_game_id;
    select * into v_game from games where id = p_game_id;
    return v_game;
  end if;

  if p_decision = 'cancel' then
    return cancel_game_internal(p_game_id);
  end if;

  update games
     set minimum_decision_status = 'go_ahead'
   where id = p_game_id;

  select * into v_game from games where id = p_game_id;
  return v_game;
end;
$$;

grant execute on function decide_game_minimum(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Idempotent host reimbursement. This intentionally settles only after kickoff
-- and only when the game is committed: minimum reached automatically
-- ('not_needed') or host/admin explicitly chose 'go_ahead'.

create or replace function settle_game_host_reimbursement(p_game_id uuid)
returns games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_game games%rowtype;
  v_collected bigint;
  v_due bigint;
  v_balance bigint;
  v_ref text;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_game from games where id = p_game_id for update;
  if not found then
    raise exception 'game not found' using errcode = 'P0002';
  end if;
  if v_game.host_id <> v_user and not is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v_game.status not in ('open', 'locked', 'played') then
    raise exception 'game cannot be settled' using errcode = 'P0001';
  end if;
  if lower(v_game.during) > now() then
    raise exception 'game has not started yet' using errcode = 'P0001';
  end if;
  if v_game.minimum_decision_status not in ('go_ahead', 'not_needed') then
    raise exception 'host has not committed this game' using errcode = 'P0001';
  end if;

  select coalesce(sum(paid_kobo), 0) into v_collected
    from game_participants
   where game_id = p_game_id
     and status in ('confirmed', 'played', 'no_show');

  v_due := least(v_collected, v_game.host_paid_kobo) - v_game.host_reimbursed_kobo;
  if v_due <= 0 then
    return v_game;
  end if;

  insert into wallets (user_id, balance_kobo) values (v_game.host_id, 0)
    on conflict (user_id) do nothing;

  update wallets set balance_kobo = balance_kobo + v_due, updated_at = now()
    where user_id = v_game.host_id
    returning balance_kobo into v_balance;

  update games
     set host_reimbursed_kobo = host_reimbursed_kobo + v_due
   where id = p_game_id
   returning * into v_game;

  v_ref := 'HRB-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

  insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, game_id)
  values (v_game.host_id, 'host_reimbursement', 'completed', v_due, v_balance, v_ref, p_game_id);

  return v_game;
end;
$$;

grant execute on function settle_game_host_reimbursement(uuid) to authenticated;
