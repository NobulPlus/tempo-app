-- ============================================================================
-- create_booking(): the write-side counterpart to join_game()/host_game() for
-- direct pitch bookings. Same reasoning as those two — locking the slot row
-- and computing the total have to happen inside one transaction, not as
-- separate client-side calls, or two people can both "successfully" book the
-- same hour, or a client-supplied total can diverge from what's charged.
--
-- The 5% service fee is computed here, in SQL — the only source of truth for
-- what a booking actually costs. src/lib/data/repo.ts's computeBookingTotal()
-- mirrors this rate for display purposes only; if the rate ever changes, both
-- places need updating.
--
-- No real payment gateway is connected yet (see checkout-form.tsx). This
-- function still marks the booking 'confirmed' and the payment 'succeeded' to
-- match the product's current demo-parity behaviour — it makes the booking a
-- real, durable Postgres row with the correct total, it does not process a
-- real charge. provider_ref stays null for exactly that reason.
-- ============================================================================

create or replace function create_booking(p_slot_id uuid, p_method payment_method)
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

  -- Lock the slot so two people can't both book the same hour.
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

  -- md5(random()::text), not uuid_generate_v4() — same reference-generation
  -- technique host_game() already uses for its slug suffix. uuid_generate_v4
  -- lives in a schema this function's `search_path = public` doesn't see;
  -- md5/random are always available from pg_catalog regardless of search_path.
  v_ref     := 'TMP-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  v_pay_ref := 'PAY-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

  insert into bookings (reference, slot_id, user_id, status, total_kobo, paid_kobo, payment_method)
  values (v_ref, p_slot_id, v_user, 'confirmed', v_total, v_total, p_method)
  returning * into v_booking;

  insert into payments (reference, user_id, booking_id, amount_kobo, method, status, provider)
  values (v_pay_ref, v_user, v_booking.id, v_total, p_method, 'succeeded', 'paystack');

  update slots set status = 'booked' where id = p_slot_id;

  return v_booking;
end;
$$;

grant execute on function create_booking(uuid, payment_method) to authenticated;
