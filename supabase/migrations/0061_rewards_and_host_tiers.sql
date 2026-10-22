-- Player points + host tiers (rewards doc, phase 1 of 4 — commission-model
-- changes and paid memberships are deliberately out of scope here).
--
-- Scope notes:
--  * Monthly point redemption (100/250/500/1000 pts) is implemented as a
--    flat wallet credit for every tier, including the two tiers the doc
--    describes as a %-discount or a badge — simplifying all of them to a
--    wallet credit keeps this phase additive with zero checkout-code
--    changes, same reasoning for every tier, not just the % one.
--  * Lifetime-point rewards (1,000 / 3,000 pts) are NOT implemented yet —
--    both reference a discount on paid membership, which doesn't exist
--    until that phase ships. The lifetime balance is tracked and shown,
--    just not yet redeemable.
--  * Host "free personal booking hour" perk is a flat monthly wallet
--    credit for gold/elite, not a literal reserved hour — same
--    simplification, for the same reason.

-- ------------------------------------------------------------ profiles --
alter table profiles add column if not exists host_tier host_tier not null default 'bronze';

-- -------------------------------------------------------- points ledger
-- Mirrors wallet_transactions: append-only, source of truth. Lifetime
-- balance is always `sum(points) where points > 0` (redemptions are
-- negative and excluded by construction) — no separate running total to
-- keep in sync.
create table player_point_entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  points       int not null,
  reason       text not null check (reason in ('hosted_game', 'joined_game', 'solo_booking', 'redemption')),
  reference_id uuid,
  created_at   timestamptz not null default now()
);

create index player_point_entries_user_idx on player_point_entries (user_id, created_at desc);

alter table player_point_entries enable row level security;
create policy player_point_entries_read_own on player_point_entries for select using (user_id = auth.uid());
revoke all on player_point_entries from anon, authenticated;
grant select on player_point_entries to authenticated;

-- ----------------------------------------------------- wallet helper ----
-- First shared wallet-credit helper in the codebase — every existing flow
-- (0012, 0029, 0036...) inlines these same three steps instead. Existing
-- call sites are deliberately NOT refactored to use this (out of scope,
-- no functional gain, avoids touching live payment code). Used only by
-- the new reward/perk paths below.
create or replace function credit_wallet(
  p_user uuid,
  p_amount_kobo bigint,
  p_type wallet_txn_type,
  p_reference text,
  p_note text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
begin
  if p_amount_kobo <= 0 then
    raise exception 'credit amount must be positive' using errcode = 'P0001';
  end if;

  insert into wallets (user_id, balance_kobo) values (p_user, 0)
    on conflict (user_id) do nothing;

  update wallets set balance_kobo = balance_kobo + p_amount_kobo, updated_at = now()
   where user_id = p_user
   returning balance_kobo into v_balance;

  insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, raw_response)
  values (p_user, p_type, 'completed', p_amount_kobo, v_balance, p_reference,
          case when p_note is not null then jsonb_build_object('note', p_note) else null end);

  return v_balance;
end;
$$;

-- Raw primitive, no caller-identity check of its own — must never be
-- directly callable by a client or it's an unlimited free-money exploit.
-- Only reachable via `perform` from other security-definer functions
-- below, which run as the function owner regardless of this revoke.
revoke all on function credit_wallet(uuid, bigint, wallet_txn_type, text, text) from public;
revoke all on function credit_wallet(uuid, bigint, wallet_txn_type, text, text) from authenticated;
revoke all on function credit_wallet(uuid, bigint, wallet_txn_type, text, text) from anon;
grant execute on function credit_wallet(uuid, bigint, wallet_txn_type, text, text) to service_role;

-- ------------------------------------------------------- point helper ---
create or replace function award_points(p_user uuid, p_points int, p_reason text, p_reference uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_points = 0 then return; end if;
  insert into player_point_entries (user_id, points, reason, reference_id)
  values (p_user, p_points, p_reason, p_reference);
end;
$$;

-- Same reasoning as credit_wallet — no caller-identity check of its own,
-- must not be directly callable (unlimited free points otherwise).
revoke all on function award_points(uuid, int, text, uuid) from public;
revoke all on function award_points(uuid, int, text, uuid) from authenticated;
revoke all on function award_points(uuid, int, text, uuid) from anon;
grant execute on function award_points(uuid, int, text, uuid) to service_role;

-- --------------------------------------------------------- host tiers ---
create or replace function recompute_host_tier(p_user uuid)
returns host_tier
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hosted_count int;
  v_old_tier host_tier;
  v_new_tier host_tier;
begin
  select host_tier into v_old_tier from profiles where id = p_user;
  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  select count(*) into v_hosted_count
    from games
   where host_id = p_user
     and status <> 'cancelled'
     and lower(during) >= now() - interval '30 days'
     and lower(during) < now();

  v_new_tier := case
    when v_hosted_count >= 20 then 'elite'::host_tier
    when v_hosted_count >= 10 then 'gold'::host_tier
    when v_hosted_count >= 5  then 'silver'::host_tier
    else 'bronze'::host_tier
  end;

  if v_new_tier <> v_old_tier then
    update profiles set host_tier = v_new_tier where id = p_user;
  end if;

  -- Flat monthly perk credit for gold/elite, idempotent via the unique
  -- wallet_transactions.reference (one grant per user per calendar month —
  -- a second attempt in the same month just hits the unique constraint).
  if v_new_tier in ('gold', 'elite') then
    begin
      perform credit_wallet(
        p_user,
        3000000, -- ₦30,000 flat stand-in for "one free personal booking hour"
        'host_perk_credit',
        'host-perk:' || p_user::text || ':' || to_char(now(), 'YYYY-MM'),
        'Monthly ' || v_new_tier::text || ' host perk'
      );
    exception when unique_violation then
      null; -- already granted this calendar month
    end;
  end if;

  return v_new_tier;
end;
$$;

-- Service-role only — same revoke/grant pattern as expire_unpaid_game_holds
-- (0023/0027/0028). This isn't exposed to clients; only the daily cron
-- calls it, looping over hosts with recent activity.
create or replace function recompute_all_host_tiers()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_count int := 0;
begin
  for v_user in
    select distinct host_id from games where lower(during) >= now() - interval '35 days'
  loop
    perform recompute_host_tier(v_user);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function recompute_all_host_tiers() from public;
revoke all on function recompute_all_host_tiers() from authenticated;
revoke all on function recompute_all_host_tiers() from anon;
grant execute on function recompute_all_host_tiers() to service_role;

-- --------------------------------------------------- point redemption ---
create or replace function redeem_points(p_user uuid, p_points_cost int)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_monthly_balance int;
  v_credit_kobo bigint;
begin
  if v_actor is null or v_actor <> p_user then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_points_cost not in (100, 250, 500, 1000) then
    raise exception 'unknown reward tier' using errcode = 'P0001';
  end if;

  select coalesce(sum(points), 0) into v_monthly_balance
    from player_point_entries
   where user_id = p_user
     and date_trunc('month', created_at) = date_trunc('month', now());

  if v_monthly_balance < p_points_cost then
    raise exception 'not enough points this month' using errcode = 'P0001';
  end if;

  v_credit_kobo := case p_points_cost
    when 100  then 1050000  -- ~35% off a typical session
    when 250  then 2500000  -- free off-peak session
    when 500  then 3500000  -- free any-time session
    when 1000 then 5000000  -- free session + a month of Silver-equivalent value
  end;

  perform award_points(p_user, -p_points_cost, 'redemption', null);
  perform credit_wallet(
    p_user, v_credit_kobo, 'reward_credit',
    'reward-redemption:' || p_user::text || ':' || gen_random_uuid()::text,
    p_points_cost::text || '-point reward redeemed'
  );

  return v_credit_kobo;
end;
$$;

-- ------------------------------------------------ attendance: fixes -----
-- Fixes a pre-existing bug (call to a function that was never defined —
-- only recompute_reputation exists) and adds point-awarding in the same
-- transaction as the status flip, for the same atomicity reputation
-- already relies on.
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
  v_old_status participant_status;
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

  v_old_status := v_participant.status;

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

  if v_status = 'played' and v_old_status <> 'played' then
    perform award_points(
      v_participant.user_id,
      case when v_participant.user_id = v_game.host_id then 30 else 15 end,
      case when v_participant.user_id = v_game.host_id then 'hosted_game' else 'joined_game' end,
      v_game.id
    );
  end if;

  if v_status in ('played', 'no_show') then
    perform recompute_reputation(v_participant.user_id);
  end if;

  return v_participant;
end;
$$;

-- -------------------------------------------- booking attendance: fix ---
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
  v_completed boolean;
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

  v_completed := p_event in ('checked_in', 'late') and upper(v_slot.during) <= now() and v_booking.status <> 'completed';

  update bookings
     set status = case when v_completed then 'completed' else status end,
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

  if v_completed then
    perform award_points(v_booking.user_id, 10, 'solo_booking', v_booking.id);
  end if;

  return v_booking;
end;
$$;

-- ----------------------------------------------- notification kinds -----
alter table user_notifications drop constraint user_notifications_kind_check;
alter table user_notifications add constraint user_notifications_kind_check
  check (kind in ('payment', 'waitlist_promoted', 'host_earnings', 'payout', 'game', 'system', 'booking', 'reward_earned', 'tier_promoted'));
