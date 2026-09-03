-- ============================================================================
-- Wallet functions: top-up (initiate/complete split across a trust boundary),
-- create_booking() rewritten to debit the wallet instead of faking a
-- successful charge, and the first real cancel_booking().
--
-- Same locking discipline as join_game()/create_booking() in 0001/0006 —
-- balance changes and their ledger row happen inside one transaction, locked
-- with `for update`, never as separate client-side calls.
-- ============================================================================

-- initiate_wallet_topup(): records intent to pay before the user ever leaves
-- the site for Flutterwave's hosted checkout. Callable by any authenticated,
-- non-suspended user — it does not move money, only opens a 'pending' ledger
-- row that complete_wallet_topup() (below) will later resolve.
create or replace function initiate_wallet_topup(p_reference text, p_amount_kobo bigint)
returns wallet_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_txn  wallet_transactions%rowtype;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from profiles where id = v_user and suspended) then
    raise exception 'account suspended' using errcode = '42501';
  end if;
  if p_amount_kobo <= 0 then
    raise exception 'invalid amount' using errcode = 'P0001';
  end if;

  insert into wallet_transactions (user_id, type, status, amount_kobo, reference, provider)
  values (v_user, 'topup', 'pending', p_amount_kobo, p_reference, 'flutterwave')
  returning * into v_txn;

  return v_txn;
end;
$$;

grant execute on function initiate_wallet_topup(text, bigint) to authenticated;

-- complete_wallet_topup(): the actual money-in boundary. Deliberately NOT
-- granted to `authenticated` — a user's own session must never be able to
-- credit their own balance directly, only the app's trusted server code
-- (holding the service-role key, after independently verifying the payment
-- with Flutterwave) may call this. Idempotent on `reference` so the
-- redirect callback and the webhook can both call it safely for the same
-- payment without double-crediting.
create or replace function complete_wallet_topup(
  p_reference    text,
  p_provider_ref text,
  p_raw          jsonb
)
returns wallet_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn     wallet_transactions%rowtype;
  v_balance bigint;
begin
  select * into v_txn from wallet_transactions where reference = p_reference for update;

  if not found then
    raise exception 'unknown topup reference' using errcode = 'P0002';
  end if;
  if v_txn.status = 'completed' then
    return v_txn;
  end if;
  if v_txn.status <> 'pending' then
    raise exception 'topup is in an unexpected state' using errcode = 'P0001';
  end if;

  insert into wallets (user_id, balance_kobo) values (v_txn.user_id, 0)
    on conflict (user_id) do nothing;

  update wallets
     set balance_kobo = balance_kobo + v_txn.amount_kobo, updated_at = now()
   where user_id = v_txn.user_id
   returning balance_kobo into v_balance;

  update wallet_transactions
     set status = 'completed', balance_after_kobo = v_balance, provider_ref = p_provider_ref, raw_response = p_raw
   where reference = p_reference
   returning * into v_txn;

  return v_txn;
end;
$$;

grant execute on function complete_wallet_topup(text, text, jsonb) to service_role;

-- create_booking(): the wallet-only rewrite. Signature drops p_method — every
-- booking is now paid the same way, so the old create_booking(uuid,
-- payment_method) is dropped first (create or replace can't change the arg
-- list). Same slot-locking as before; the new step is locking the caller's
-- wallet and debiting it instead of unconditionally writing a 'succeeded'
-- payment row.
drop function if exists create_booking(uuid, payment_method);

create or replace function create_booking(p_slot_id uuid)
returns bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_slot    slots%rowtype;
  v_fee     bigint;
  v_total   bigint;
  v_balance bigint;
  v_ref     text;
  v_pay_ref text;
  v_booking bookings%rowtype;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if exists (select 1 from profiles where id = v_user and suspended) then
    raise exception 'account suspended' using errcode = '42501';
  end if;

  select * into v_slot from slots where id = p_slot_id for update;

  if not found then
    raise exception 'slot not found' using errcode = 'P0002';
  end if;
  if v_slot.status <> 'open' then
    raise exception 'slot is no longer available' using errcode = 'P0001';
  end if;
  if v_slot.starts_at <= now() then
    raise exception 'that time has already passed' using errcode = 'P0001';
  end if;

  v_fee   := round(v_slot.price_kobo * 0.05);
  v_total := v_slot.price_kobo + v_fee;

  insert into wallets (user_id, balance_kobo) values (v_user, 0)
    on conflict (user_id) do nothing;

  select balance_kobo into v_balance from wallets where user_id = v_user for update;

  if v_balance < v_total then
    raise exception 'insufficient wallet balance' using errcode = 'P0001';
  end if;

  update wallets set balance_kobo = balance_kobo - v_total, updated_at = now() where user_id = v_user;

  v_ref     := 'TMP-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  v_pay_ref := 'PAY-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

  insert into bookings (reference, slot_id, user_id, status, total_kobo, paid_kobo, payment_method)
  values (v_ref, p_slot_id, v_user, 'confirmed', v_total, v_total, 'wallet')
  returning * into v_booking;

  insert into payments (reference, user_id, booking_id, amount_kobo, method, status, provider)
  values (v_pay_ref, v_user, v_booking.id, v_total, 'wallet', 'succeeded', 'wallet');

  insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, booking_id)
  values (v_user, 'booking_payment', 'completed', -v_total, v_balance - v_total, v_pay_ref, v_booking.id);

  update slots set status = 'booked' where id = p_slot_id;

  return v_booking;
end;
$$;

grant execute on function create_booking(uuid) to authenticated;

-- cancel_booking(): the first real cancellation path in the app. 6-hour
-- cutoff matches the rewritten /legal/refunds policy exactly — 6 hours or
-- more before kickoff credits the wallet in full, under 6 hours forfeits it.
-- Either way the slot reopens (the policy text says an under-6-hour slot
-- "almost never re-sells", not that it's pulled from sale).
create or replace function cancel_booking(p_booking_id uuid)
returns bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_booking bookings%rowtype;
  v_slot    slots%rowtype;
  v_credit  bigint := 0;
  v_balance bigint;
  v_ref     text;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_booking from bookings where id = p_booking_id and user_id = v_user for update;

  if not found then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  if v_booking.status <> 'confirmed' then
    raise exception 'booking cannot be cancelled' using errcode = 'P0001';
  end if;

  select * into v_slot from slots where id = v_booking.slot_id for update;

  if lower(v_slot.during) - now() >= interval '6 hours' then
    v_credit := v_booking.paid_kobo;
  end if;

  update bookings set status = 'cancelled', cancelled_at = now(), cancel_reason = 'user_cancelled'
  where id = p_booking_id;

  update slots set status = 'open' where id = v_booking.slot_id;

  if v_credit > 0 then
    insert into wallets (user_id, balance_kobo) values (v_user, 0)
      on conflict (user_id) do nothing;

    update wallets set balance_kobo = balance_kobo + v_credit, updated_at = now()
      where user_id = v_user
      returning balance_kobo into v_balance;

    v_ref := 'CRD-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

    insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, booking_id)
    values (v_user, 'cancellation_credit', 'completed', v_credit, v_balance, v_ref, p_booking_id);
  end if;

  select * into v_booking from bookings where id = p_booking_id;
  return v_booking;
end;
$$;

grant execute on function cancel_booking(uuid) to authenticated;
