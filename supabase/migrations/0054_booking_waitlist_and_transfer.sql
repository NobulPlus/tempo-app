-- Booking waitlist + friend-to-friend slot transfer for direct pitch
-- bookings. Mirrors the existing game-side waitlist/transfer conventions
-- (0030, 0039) exactly, just for the 1:1 booking/slot model instead of
-- game_participants. slots.status='held' and slots.held_until have existed
-- since 0001_init.sql but were never used by any function until now.

create type booking_transfer_status as enum ('open', 'accepted', 'cancelled', 'expired');

alter table slots add column if not exists held_for_user_id uuid references profiles(id) on delete set null;

alter table user_notifications drop constraint user_notifications_kind_check;
alter table user_notifications add constraint user_notifications_kind_check
  check (kind in ('payment', 'waitlist_promoted', 'host_earnings', 'payout', 'game', 'system', 'booking'));

-- ---------------------------------------------------------- waitlist
create table booking_waitlist (
  id         uuid primary key default gen_random_uuid(),
  slot_id    uuid not null references slots(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (slot_id, user_id)
);

create index booking_waitlist_slot_idx on booking_waitlist (slot_id, created_at);

alter table booking_waitlist enable row level security;
create policy booking_waitlist_read_own on booking_waitlist for select using (user_id = auth.uid());
create policy booking_waitlist_insert_own on booking_waitlist for insert with check (user_id = auth.uid());
create policy booking_waitlist_delete_own on booking_waitlist for delete using (user_id = auth.uid());

create or replace function join_booking_waitlist(p_slot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_slot slots%rowtype;
begin
  if v_user is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if exists (select 1 from profiles where id = v_user and suspended) then
    raise exception 'account suspended' using errcode = '42501';
  end if;

  select * into v_slot from slots where id = p_slot_id;
  if not found then raise exception 'slot not found' using errcode = 'P0002'; end if;
  if v_slot.status = 'open' then raise exception 'that slot is already available to book' using errcode = 'P0001'; end if;
  if v_slot.status = 'held' and v_slot.held_for_user_id = v_user then
    raise exception 'that slot is already reserved for you' using errcode = 'P0001';
  end if;
  if lower(v_slot.during) <= now() then raise exception 'that time has already passed' using errcode = 'P0001'; end if;

  insert into booking_waitlist (slot_id, user_id) values (p_slot_id, v_user)
  on conflict (slot_id, user_id) do nothing;
end;
$$;

create or replace function leave_booking_waitlist(p_slot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from booking_waitlist where slot_id = p_slot_id and user_id = auth.uid();
end;
$$;

grant execute on function join_booking_waitlist(uuid) to authenticated;
grant execute on function leave_booking_waitlist(uuid) to authenticated;

-- ---------------------------------------------------------- transfer offers
create table booking_transfer_offers (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references bookings(id) on delete cascade,
  from_user_id uuid not null references profiles(id) on delete cascade,
  to_user_id  uuid not null references profiles(id) on delete cascade,
  status      booking_transfer_status not null default 'open',
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index booking_transfer_open_unique on booking_transfer_offers (booking_id) where status = 'open';
create index booking_transfer_to_idx on booking_transfer_offers (to_user_id, status);

alter table booking_transfer_offers enable row level security;
create policy booking_transfer_read_parties on booking_transfer_offers for select
  using (is_admin() or from_user_id = auth.uid() or to_user_id = auth.uid());
-- No direct insert/update policy: every write goes through the RPCs below,
-- same "RPC-only write" discipline every money-adjacent table in this
-- codebase already follows.

-- ---------------------------------------------------------- cancel_booking (waitlist-aware)
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
  v_next    booking_waitlist%rowtype;
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

  if v_credit > 0 then
    perform cancel_venue_settlement_for_booking(p_booking_id);
    insert into wallets (user_id, balance_kobo) values (v_user, 0) on conflict (user_id) do nothing;
    update wallets set balance_kobo = balance_kobo + v_credit, updated_at = now()
      where wallets.user_id = v_user
      returning balance_kobo into v_balance;
    v_ref := 'CRD-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, booking_id)
    values (v_user, 'cancellation_credit', 'completed', v_credit, v_balance, v_ref, p_booking_id);
  end if;

  -- Waitlist-aware reopen: reserve for the earliest waiter instead of a
  -- plain open, capped so a hold can never survive past kickoff.
  select * into v_next from booking_waitlist
   where slot_id = v_booking.slot_id
   order by created_at limit 1 for update;

  if found then
    update slots set status = 'held', held_for_user_id = v_next.user_id,
      held_until = least(now() + interval '45 minutes', lower(v_slot.during))
     where id = v_booking.slot_id;
    delete from booking_waitlist where id = v_next.id;
    insert into user_notifications (user_id, kind, title, body, href)
    values (
      v_next.user_id, 'booking', 'A slot opened up',
      'A pitch you were waiting for is reserved for you for the next 45 minutes.',
      '/pitches/' || (select slug from pitches where id = v_slot.pitch_id) || '/book?slot=' || v_booking.slot_id
    );
  else
    update slots set status = 'open', held_for_user_id = null, held_until = null where id = v_booking.slot_id;
  end if;

  select * into v_booking from bookings where id = p_booking_id;
  return v_booking;
end;
$$;

grant execute on function cancel_booking(uuid) to authenticated;

-- ---------------------------------------------------------- create_booking (held-slot aware)
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
  if v_user is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if exists (select 1 from profiles where id = v_user and suspended) then
    raise exception 'account suspended' using errcode = '42501';
  end if;

  select * into v_slot from slots where id = p_slot_id for update;
  if not found then raise exception 'slot not found' using errcode = 'P0002'; end if;

  if v_slot.status = 'held' and v_slot.held_for_user_id = v_user and v_slot.held_until > now() then
    null; -- reserved for this exact caller, still within the window: proceed
  elsif v_slot.status <> 'open' then
    raise exception 'slot is no longer available' using errcode = 'P0001';
  end if;
  if lower(v_slot.during) <= now() then raise exception 'that time has already passed' using errcode = 'P0001'; end if;

  v_fee   := round(v_slot.price_kobo * 0.05);
  v_total := v_slot.price_kobo + v_fee;

  insert into wallets (user_id, balance_kobo) values (v_user, 0) on conflict (user_id) do nothing;
  select balance_kobo into v_balance from wallets where user_id = v_user for update;
  if v_balance < v_total then raise exception 'insufficient wallet balance' using errcode = 'P0001'; end if;

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

  perform create_venue_settlement_for_slot('booking', p_slot_id, v_booking.id, null);

  update slots set status = 'booked', held_for_user_id = null, held_until = null where id = p_slot_id;
  return v_booking;
end;
$$;

grant execute on function create_booking(uuid) to authenticated;

-- ---------------------------------------------------------- expiry (service-role only)
create or replace function expire_booking_slot_holds()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot slots%rowtype;
  v_next booking_waitlist%rowtype;
  v_count int := 0;
begin
  for v_slot in
    select * from slots where status = 'held' and held_until < now() for update skip locked
  loop
    select * into v_next from booking_waitlist
     where slot_id = v_slot.id
     order by created_at limit 1 for update;

    if found then
      update slots set held_for_user_id = v_next.user_id,
        held_until = least(now() + interval '45 minutes', lower(v_slot.during))
       where id = v_slot.id;
      delete from booking_waitlist where id = v_next.id;
      insert into user_notifications (user_id, kind, title, body, href)
      values (
        v_next.user_id, 'booking', 'A slot opened up',
        'A pitch you were waiting for is reserved for you for the next 45 minutes.',
        '/pitches/' || (select slug from pitches where id = v_slot.pitch_id) || '/book?slot=' || v_slot.id
      );
    else
      update slots set status = 'open', held_for_user_id = null, held_until = null where id = v_slot.id;
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function expire_booking_slot_holds() from public, authenticated, anon;
grant execute on function expire_booking_slot_holds() to service_role;

-- ---------------------------------------------------------- offer / accept transfer
create or replace function offer_booking_transfer(p_booking_id uuid, p_to_user_id uuid)
returns booking_transfer_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_booking bookings%rowtype;
  v_slot  slots%rowtype;
  v_offer booking_transfer_offers%rowtype;
begin
  if v_user is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_to_user_id = v_user then raise exception 'cannot transfer to yourself' using errcode = 'P0001'; end if;
  if exists (select 1 from profiles where id = v_user and suspended) then
    raise exception 'account suspended' using errcode = '42501';
  end if;
  if not exists (select 1 from profiles where id = p_to_user_id and not suspended) then
    raise exception 'that player is not available to receive a transfer' using errcode = 'P0002';
  end if;

  select * into v_booking from bookings where id = p_booking_id and user_id = v_user for update;
  if not found then raise exception 'booking not found' using errcode = 'P0002'; end if;
  if v_booking.status <> 'confirmed' then raise exception 'booking cannot be transferred' using errcode = 'P0001'; end if;

  select * into v_slot from slots where id = v_booking.slot_id;
  if lower(v_slot.during) - now() <= interval '2 hours' then
    raise exception 'too close to kickoff to transfer' using errcode = 'P0001';
  end if;

  update booking_transfer_offers set status = 'expired', updated_at = now()
   where booking_id = p_booking_id and status = 'open';

  insert into booking_transfer_offers (booking_id, from_user_id, to_user_id, expires_at)
  values (p_booking_id, v_user, p_to_user_id, least(now() + interval '24 hours', lower(v_slot.during) - interval '2 hours'))
  returning * into v_offer;

  insert into user_notifications (user_id, kind, title, body, href)
  values (
    p_to_user_id, 'booking', 'A friend wants to send you a booking',
    'You have a pitch booking offer waiting — accept it before it expires.',
    '/bookings/transfer/' || v_offer.id
  );

  return v_offer;
end;
$$;

create or replace function accept_booking_transfer(p_offer_id uuid)
returns bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_offer   booking_transfer_offers%rowtype;
  v_booking bookings%rowtype;
  v_balance bigint;
  v_ref     text;
  v_new_code text;
begin
  if v_user is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if exists (select 1 from profiles where id = v_user and suspended) then
    raise exception 'account suspended' using errcode = '42501';
  end if;

  select * into v_offer from booking_transfer_offers where id = p_offer_id for update;
  if not found then raise exception 'transfer offer not found' using errcode = 'P0002'; end if;
  if v_offer.to_user_id <> v_user then raise exception 'this offer is for another player' using errcode = '42501'; end if;
  if v_offer.status <> 'open' then raise exception 'this offer is no longer available' using errcode = 'P0001'; end if;
  if v_offer.expires_at < now() then
    update booking_transfer_offers set status = 'expired', updated_at = now() where id = p_offer_id;
    raise exception 'this offer has expired' using errcode = 'P0001';
  end if;

  select * into v_booking from bookings where id = v_offer.booking_id for update;
  if v_booking.status <> 'confirmed' then raise exception 'this booking is no longer transferable' using errcode = 'P0001'; end if;

  insert into wallets (user_id, balance_kobo) values (v_user, 0) on conflict (user_id) do nothing;
  select balance_kobo into v_balance from wallets where user_id = v_user for update;
  if v_balance < v_booking.total_kobo then raise exception 'insufficient wallet balance' using errcode = 'P0001'; end if;

  update wallets set balance_kobo = balance_kobo - v_booking.total_kobo, updated_at = now()
    where user_id = v_user returning balance_kobo into v_balance;
  v_ref := 'PAY-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, booking_id)
  values (v_user, 'booking_payment', 'completed', -v_booking.total_kobo, v_balance, v_ref, v_booking.id);

  insert into wallets (user_id, balance_kobo) values (v_offer.from_user_id, 0) on conflict (user_id) do nothing;
  update wallets set balance_kobo = balance_kobo + v_booking.paid_kobo, updated_at = now()
    where user_id = v_offer.from_user_id returning balance_kobo into v_balance;
  v_ref := 'CRD-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, booking_id)
  values (v_offer.from_user_id, 'cancellation_credit', 'completed', v_booking.paid_kobo, v_balance, v_ref, v_booking.id);

  v_new_code := 'BKG-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  update bookings set user_id = v_user, check_in_code = v_new_code where id = v_booking.id
  returning * into v_booking;

  update booking_transfer_offers set status = 'accepted', accepted_at = now(), updated_at = now() where id = p_offer_id;

  insert into user_notifications (user_id, kind, title, body, href)
  values (v_user, 'booking', 'Booking transfer complete', 'The booking is now yours — see you there.', '/bookings/' || v_booking.reference);
  insert into user_notifications (user_id, kind, title, body, href)
  values (v_offer.from_user_id, 'booking', 'Transfer accepted', 'Your credit has been added back to your wallet.', '/wallet');

  return v_booking;
end;
$$;

create or replace function cancel_booking_transfer_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update booking_transfer_offers set status = 'cancelled', updated_at = now()
   where id = p_offer_id and from_user_id = auth.uid() and status = 'open';
end;
$$;

grant execute on function offer_booking_transfer(uuid, uuid) to authenticated;
grant execute on function accept_booking_transfer(uuid) to authenticated;
grant execute on function cancel_booking_transfer_offer(uuid) to authenticated;
