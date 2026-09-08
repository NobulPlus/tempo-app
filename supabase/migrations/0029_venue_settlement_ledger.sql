-- ============================================================================
-- Venue/platform settlement ledger.
--
-- The wallet ledger tells us what happened to a user's balance. These tables
-- tell us what the marketplace owes venues and what Tempo keeps as platform
-- fee, so bookings and hosted games have a complete financial lifecycle.
-- ============================================================================

create type venue_settlement_source as enum ('booking', 'game');
create type venue_settlement_status as enum ('pending', 'cancelled', 'paid');
create type venue_payout_status as enum ('paid');

create table venue_payouts (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid not null references venues(id) on delete restrict,
  owner_id uuid references profiles(id) on delete set null,
  amount_kobo bigint not null check (amount_kobo > 0),
  status venue_payout_status not null default 'paid',
  reference text unique not null,
  paid_at timestamptz not null default now(),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table venue_settlements (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid not null references venues(id) on delete restrict,
  owner_id uuid references profiles(id) on delete set null,
  source venue_settlement_source not null,
  booking_id uuid references bookings(id) on delete set null,
  game_id uuid references games(id) on delete set null,
  slot_id uuid references slots(id) on delete set null,
  gross_kobo bigint not null check (gross_kobo >= 0),
  platform_fee_kobo bigint not null check (platform_fee_kobo >= 0),
  venue_amount_kobo bigint not null check (venue_amount_kobo >= 0),
  status venue_settlement_status not null default 'pending',
  available_at timestamptz not null,
  cancelled_at timestamptz,
  paid_at timestamptz,
  payout_id uuid references venue_payouts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint venue_settlement_source_ref check (
    (source = 'booking' and booking_id is not null and game_id is null)
    or
    (source = 'game' and game_id is not null and booking_id is null)
  ),
  constraint venue_settlement_paid_has_payout check (
    status <> 'paid' or (payout_id is not null and paid_at is not null)
  ),
  constraint venue_settlement_cancel_has_time check (
    status <> 'cancelled' or cancelled_at is not null
  )
);

create unique index venue_settlements_booking_unique
  on venue_settlements (booking_id)
  where booking_id is not null;

create unique index venue_settlements_game_unique
  on venue_settlements (game_id)
  where game_id is not null;

create index venue_settlements_venue_status_idx
  on venue_settlements (venue_id, status, available_at);

create index venue_payouts_venue_created_idx
  on venue_payouts (venue_id, created_at desc);

alter table venue_settlements enable row level security;
alter table venue_payouts enable row level security;

create policy venue_settlements_read_owner_admin on venue_settlements
  for select using (
    is_admin()
    or exists (
      select 1 from venues v
       where v.id = venue_settlements.venue_id
         and v.owner_id = auth.uid()
    )
  );

create policy venue_payouts_read_owner_admin on venue_payouts
  for select using (
    is_admin()
    or exists (
      select 1 from venues v
       where v.id = venue_payouts.venue_id
         and v.owner_id = auth.uid()
    )
  );

create or replace function create_venue_settlement_for_slot(
  p_source venue_settlement_source,
  p_slot_id uuid,
  p_booking_id uuid,
  p_game_id uuid
)
returns venue_settlements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot slots%rowtype;
  v_venue venues%rowtype;
  v_fee bigint;
  v_settlement venue_settlements%rowtype;
begin
  select * into v_slot from slots where id = p_slot_id;
  if not found then
    raise exception 'slot not found' using errcode = 'P0002';
  end if;

  select v.* into v_venue
    from pitches p
    join venues v on v.id = p.venue_id
   where p.id = v_slot.pitch_id;

  if not found then
    raise exception 'venue not found' using errcode = 'P0002';
  end if;

  v_fee := round(v_slot.price_kobo * 0.05);

  insert into venue_settlements (
    venue_id, owner_id, source, booking_id, game_id, slot_id,
    gross_kobo, platform_fee_kobo, venue_amount_kobo, available_at
  ) values (
    v_venue.id, v_venue.owner_id, p_source, p_booking_id, p_game_id, p_slot_id,
    v_slot.price_kobo, v_fee, v_slot.price_kobo, upper(v_slot.during) + interval '24 hours'
  )
  returning * into v_settlement;

  return v_settlement;
end;
$$;

revoke all on function create_venue_settlement_for_slot(venue_settlement_source, uuid, uuid, uuid) from public;
revoke all on function create_venue_settlement_for_slot(venue_settlement_source, uuid, uuid, uuid) from authenticated;
revoke all on function create_venue_settlement_for_slot(venue_settlement_source, uuid, uuid, uuid) from anon;

create or replace function cancel_venue_settlement_for_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update venue_settlements
     set status = 'cancelled',
         cancelled_at = now(),
         updated_at = now()
   where booking_id = p_booking_id
     and status = 'pending';
end;
$$;

revoke all on function cancel_venue_settlement_for_booking(uuid) from public;
revoke all on function cancel_venue_settlement_for_booking(uuid) from authenticated;
revoke all on function cancel_venue_settlement_for_booking(uuid) from anon;

create or replace function cancel_venue_settlement_for_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update venue_settlements
     set status = 'cancelled',
         cancelled_at = now(),
         updated_at = now()
   where game_id = p_game_id
     and status = 'pending';
end;
$$;

revoke all on function cancel_venue_settlement_for_game(uuid) from public;
revoke all on function cancel_venue_settlement_for_game(uuid) from authenticated;
revoke all on function cancel_venue_settlement_for_game(uuid) from anon;

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
  if lower(v_slot.during) <= now() then
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

  perform create_venue_settlement_for_slot('booking', p_slot_id, v_booking.id, null);

  update slots set status = 'booked' where id = p_slot_id;

  return v_booking;
end;
$$;

grant execute on function create_booking(uuid) to authenticated;

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
    perform cancel_venue_settlement_for_booking(p_booking_id);

    insert into wallets (user_id, balance_kobo) values (v_user, 0)
      on conflict (user_id) do nothing;

    update wallets set balance_kobo = balance_kobo + v_credit, updated_at = now()
      where wallets.user_id = v_user
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
   where wallets.user_id = v_user;

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

  perform create_venue_settlement_for_slot('game', p_slot_id, null, v_game.id);

  update slots set status = 'booked' where id = p_slot_id;

  insert into game_participants (game_id, user_id, status, paid_kobo)
  values (v_game.id, v_user, 'confirmed', 0);

  return v_game;
end;
$$;

grant execute on function host_game(uuid, text, text, skill_level, int, int, bigint, boolean) to authenticated;

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
      where wallets.user_id = v_p.user_id
      returning balance_kobo into v_balance;

    v_ref := 'GRF-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

    insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, game_id)
    values (v_p.user_id, 'game_refund', 'completed', v_p.paid_kobo, v_balance, v_ref, p_game_id);

    insert into game_cancellation_refunds (game_id, user_id, amount_kobo)
    values (p_game_id, v_p.user_id, v_p.paid_kobo)
    on conflict (game_id, user_id) do update
      set amount_kobo = excluded.amount_kobo,
          created_at = now(),
          notified_at = null;
  end loop;

  update game_participants
     set status = 'withdrawn',
         payment_deadline = null,
         reminder_1h_sent_at = null,
         reminder_30m_sent_at = null
   where game_id = p_game_id
     and status in ('confirmed', 'pending_payment', 'waitlist');

  v_host_refund := greatest(0, v_game.host_paid_kobo - v_game.host_reimbursed_kobo);
  if v_host_refund > 0 and lower(v_game.during) - now() >= interval '6 hours' then
    perform cancel_venue_settlement_for_game(p_game_id);

    insert into wallets (user_id, balance_kobo) values (v_game.host_id, 0)
      on conflict (user_id) do nothing;

    update wallets set balance_kobo = balance_kobo + v_host_refund, updated_at = now()
      where wallets.user_id = v_game.host_id
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

create or replace function admin_mark_venue_payout_paid(p_venue_id uuid, p_reference text default null)
returns venue_payouts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_venue venues%rowtype;
  v_amount bigint;
  v_settlement_ids uuid[];
  v_payout venue_payouts%rowtype;
begin
  if v_admin is null or not is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into v_venue from venues where id = p_venue_id for update;
  if not found then
    raise exception 'venue not found' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[]), coalesce(sum(venue_amount_kobo), 0)
    into v_settlement_ids, v_amount
    from (
      select id, venue_amount_kobo
        from venue_settlements
       where venue_id = p_venue_id
         and status = 'pending'
         and available_at <= now()
       for update
    ) payable;

  if v_amount <= 0 then
    raise exception 'no payable venue settlements are available' using errcode = 'P0001';
  end if;

  insert into venue_payouts (venue_id, owner_id, amount_kobo, reference, created_by)
  values (
    p_venue_id,
    v_venue.owner_id,
    v_amount,
    coalesce(nullif(p_reference, ''), 'VPO-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))),
    v_admin
  )
  returning * into v_payout;

  update venue_settlements
     set status = 'paid',
         payout_id = v_payout.id,
         paid_at = v_payout.paid_at,
         updated_at = now()
   where id = any(v_settlement_ids);

  return v_payout;
end;
$$;

grant execute on function admin_mark_venue_payout_paid(uuid, text) to authenticated;
