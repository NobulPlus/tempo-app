-- Exact-action payments.
--
-- Tempo should not encourage casual wallet funding. A user pays for the
-- booking/game action they are taking, and this intent records that purpose
-- until the gateway callback/webhook verifies the money.

create extension if not exists "pgcrypto";

create type action_payment_kind as enum ('booking', 'host_game', 'join_game', 'game_balance');
create type action_payment_status as enum ('pending', 'completed', 'failed');

create table action_payment_intents (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  user_id uuid not null references profiles(id) on delete restrict,
  kind action_payment_kind not null,
  provider text not null check (provider in ('korapay', 'flutterwave')),
  amount_kobo bigint not null check (amount_kobo > 0),
  status action_payment_status not null default 'pending',
  slot_id uuid references slots(id) on delete set null,
  game_id uuid references games(id) on delete set null,
  participant_id uuid references game_participants(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  provider_ref text,
  raw_response jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint action_payment_kind_target check (
    (kind in ('booking', 'host_game') and slot_id is not null and game_id is null)
    or
    (kind in ('join_game', 'game_balance') and game_id is not null)
  ),
  constraint action_payment_completed_has_time check (
    status <> 'completed' or completed_at is not null
  )
);

create index action_payment_intents_user_idx
  on action_payment_intents (user_id, created_at desc);

create index action_payment_intents_status_idx
  on action_payment_intents (status, created_at);

alter table action_payment_intents enable row level security;

create policy action_payment_intents_read_own_admin on action_payment_intents
  for select using (auth.uid() = user_id or is_admin());

create or replace function touch_action_payment_intents()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger action_payment_intents_touch
before update on action_payment_intents
for each row execute function touch_action_payment_intents();

-- Holds a public-game spot while the user is away at checkout. If the game is
-- already full, the user is waitlisted with no payment needed.
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
  if v_game.status <> 'open' then
    raise exception 'game is not open' using errcode = 'P0001';
  end if;
  if lower(v_game.during) <= now() then
    raise exception 'game has already started' using errcode = 'P0001';
  end if;
  if v_game.host_id = v_user then
    raise exception 'host is already in this game' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from game_participants
     where game_id = p_game_id
       and user_id = v_user
       and status in ('confirmed', 'pending_payment', 'waitlist', 'played', 'no_show')
  ) then
    raise exception 'already joined this game' using errcode = 'P0001';
  end if;

  select count(*) into v_count
    from game_participants
   where game_id = p_game_id
     and status in ('confirmed', 'pending_payment');

  v_status := case
    when v_count >= v_game.capacity then 'waitlist'
    when v_game.price_per_player_kobo <= 0 then 'confirmed'
    else 'pending_payment'
  end;

  insert into game_participants (game_id, user_id, status, paid_kobo, payment_deadline)
  values (
    p_game_id,
    v_user,
    v_status,
    0,
    case
      when v_status = 'pending_payment' then least(now() + interval '48 hours', lower(v_game.during) - interval '2 hours')
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

  if v_status in ('confirmed', 'pending_payment') and v_count + 1 >= v_game.minimum_to_guarantee then
    update games set minimum_decision_status = 'not_needed'
     where id = p_game_id
       and minimum_decision_status = 'pending';
  end if;

  return v_row;
end;
$$;

grant execute on function start_external_game_join(uuid) to authenticated;

-- service_role-only gateway completion. Browser callbacks and webhooks both
-- call this after independently verifying the gateway transaction.
create or replace function complete_action_payment(
  p_reference text,
  p_amount_kobo bigint,
  p_provider_ref text,
  p_raw jsonb
)
returns action_payment_intents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent action_payment_intents%rowtype;
  v_slot slots%rowtype;
  v_booking bookings%rowtype;
  v_game games%rowtype;
  v_participant game_participants%rowtype;
  v_balance bigint;
  v_ref text;
  v_pay_ref text;
  v_slug text;
  v_count int;
begin
  select * into v_intent
    from action_payment_intents
   where reference = p_reference
   for update;

  if not found then
    raise exception 'payment intent not found' using errcode = 'P0002';
  end if;
  if v_intent.status = 'completed' then
    return v_intent;
  end if;
  if v_intent.status <> 'pending' then
    raise exception 'payment intent is not pending' using errcode = 'P0001';
  end if;
  if v_intent.amount_kobo <> p_amount_kobo then
    raise exception 'payment amount mismatch' using errcode = 'P0001';
  end if;

  insert into wallets (user_id, balance_kobo) values (v_intent.user_id, 0)
    on conflict (user_id) do nothing;
  select balance_kobo into v_balance from wallets where user_id = v_intent.user_id for update;

  if v_intent.kind = 'booking' then
    select * into v_slot from slots where id = v_intent.slot_id for update;
    if not found then
      raise exception 'slot not found' using errcode = 'P0002';
    end if;
    if v_slot.status <> 'open' then
      raise exception 'slot is no longer available' using errcode = 'P0001';
    end if;
    if lower(v_slot.during) <= now() then
      raise exception 'that time has already passed' using errcode = 'P0001';
    end if;

    if p_amount_kobo <> v_slot.price_kobo + round(v_slot.price_kobo * 0.05) then
      raise exception 'booking amount mismatch' using errcode = 'P0001';
    end if;

    v_ref := 'TMP-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    v_pay_ref := 'PAY-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

    insert into bookings (reference, slot_id, user_id, status, total_kobo, paid_kobo, payment_method)
    values (v_ref, v_slot.id, v_intent.user_id, 'confirmed', p_amount_kobo, p_amount_kobo, 'card')
    returning * into v_booking;

    insert into payments (reference, user_id, booking_id, amount_kobo, method, status, provider, provider_ref, raw_response, settled_at)
    values (v_pay_ref, v_intent.user_id, v_booking.id, p_amount_kobo, 'card', 'succeeded', v_intent.provider, p_provider_ref, p_raw, now());

    insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, provider, provider_ref, booking_id)
    values (v_intent.user_id, 'booking_payment', 'completed', -p_amount_kobo, v_balance, v_pay_ref, v_intent.provider, p_provider_ref, v_booking.id);

    perform create_venue_settlement_for_slot('booking', v_slot.id, v_booking.id, null);
    update slots set status = 'booked' where id = v_slot.id;

    v_intent.payload := v_intent.payload || jsonb_build_object('booking_id', v_booking.id, 'booking_reference', v_booking.reference);

  elsif v_intent.kind = 'host_game' then
    select * into v_slot from slots where id = v_intent.slot_id for update;
    if not found then
      raise exception 'slot not found' using errcode = 'P0002';
    end if;
    if v_slot.status <> 'open' then
      raise exception 'slot is no longer available' using errcode = 'P0001';
    end if;
    if lower(v_slot.during) <= now() then
      raise exception 'that time has already passed' using errcode = 'P0001';
    end if;
    if p_amount_kobo <> v_slot.price_kobo + round(v_slot.price_kobo * 0.05) then
      raise exception 'host booking amount mismatch' using errcode = 'P0001';
    end if;

    v_slug := lower(regexp_replace(coalesce(v_intent.payload->>'title', 'tempo-game'), '[^a-zA-Z0-9]+', '-', 'g'))
              || '-' || substr(md5(random()::text), 1, 6);

    insert into games (
      slug, pitch_id, host_id, title, description, level, during,
      capacity, minimum_to_guarantee, price_per_player_kobo, status,
      bibs_provided, host_paid_kobo, host_reimbursed_kobo,
      host_pitch_cost_kobo, host_booking_fee_kobo, host_earnings_kobo,
      minimum_decision_deadline, minimum_decision_status
    ) values (
      v_slug,
      v_slot.pitch_id,
      v_intent.user_id,
      coalesce(v_intent.payload->>'title', 'Tempo game'),
      coalesce(v_intent.payload->>'description', ''),
      coalesce(v_intent.payload->>'level', 'casual')::skill_level,
      v_slot.during,
      coalesce((v_intent.payload->>'capacity')::int, 10),
      coalesce((v_intent.payload->>'minimum_to_guarantee')::int, 8),
      coalesce((v_intent.payload->>'price_per_player_kobo')::bigint, 0),
      'open',
      coalesce((v_intent.payload->>'bibs_provided')::boolean, false),
      p_amount_kobo,
      0,
      v_slot.price_kobo,
      greatest(0, p_amount_kobo - v_slot.price_kobo),
      0,
      greatest(now(), lower(v_slot.during) - interval '6 hours'),
      case
        when coalesce((v_intent.payload->>'minimum_to_guarantee')::int, 8) <= 1 then 'not_needed'
        else 'pending'
      end
    )
    returning * into v_game;

    v_ref := 'HST-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, provider, provider_ref, game_id)
    values (v_intent.user_id, 'host_game_deposit', 'completed', -p_amount_kobo, v_balance, v_ref, v_intent.provider, p_provider_ref, v_game.id);

    perform create_venue_settlement_for_slot('game', v_slot.id, null, v_game.id);
    update slots set status = 'booked' where id = v_slot.id;

    insert into game_participants (game_id, user_id, status, paid_kobo)
    values (v_game.id, v_intent.user_id, 'confirmed', 0);

    v_intent.payload := v_intent.payload || jsonb_build_object('game_id', v_game.id, 'game_slug', v_game.slug);

  elsif v_intent.kind in ('join_game', 'game_balance') then
    select * into v_game from games where id = v_intent.game_id for update;
    if not found then
      raise exception 'game not found' using errcode = 'P0002';
    end if;
    if v_game.status not in ('open', 'locked') then
      raise exception 'game is not open' using errcode = 'P0001';
    end if;
    if lower(v_game.during) <= now() then
      raise exception 'game has already started' using errcode = 'P0001';
    end if;

    select * into v_participant
      from game_participants
     where game_id = v_game.id
       and user_id = v_intent.user_id
     for update;

    if not found then
      raise exception 'game hold not found' using errcode = 'P0002';
    end if;
    if v_participant.status <> 'pending_payment' then
      raise exception 'no payment is due' using errcode = 'P0001';
    end if;
    if p_amount_kobo <> v_game.price_per_player_kobo - v_participant.paid_kobo then
      raise exception 'game payment amount mismatch' using errcode = 'P0001';
    end if;

    v_ref := 'GPY-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, provider, provider_ref, game_id)
    values (v_intent.user_id, 'game_payment', 'completed', -p_amount_kobo, v_balance, v_ref, v_intent.provider, p_provider_ref, v_game.id);

    update game_participants
       set paid_kobo = paid_kobo + p_amount_kobo,
           status = 'confirmed',
           payment_deadline = null
     where id = v_participant.id
     returning * into v_participant;

    select count(*) into v_count
      from game_participants
     where game_id = v_game.id
       and status in ('confirmed', 'pending_payment');

    if v_count >= v_game.capacity then
      update games set status = 'locked' where id = v_game.id;
    end if;
    if v_count >= v_game.minimum_to_guarantee then
      update games set minimum_decision_status = 'not_needed'
       where id = v_game.id
         and minimum_decision_status = 'pending';
    end if;

    v_intent.participant_id := v_participant.id;
    v_intent.payload := v_intent.payload || jsonb_build_object('participant_id', v_participant.id, 'game_slug', v_game.slug);
  end if;

  update action_payment_intents
     set status = 'completed',
         provider_ref = p_provider_ref,
         raw_response = p_raw,
         completed_at = now(),
         payload = v_intent.payload,
         participant_id = v_intent.participant_id
   where id = v_intent.id
   returning * into v_intent;

  return v_intent;
end;
$$;

revoke all on function complete_action_payment(text, bigint, text, jsonb) from public;
revoke all on function complete_action_payment(text, bigint, text, jsonb) from authenticated;
revoke all on function complete_action_payment(text, bigint, text, jsonb) from anon;
grant execute on function complete_action_payment(text, bigint, text, jsonb) to service_role;
