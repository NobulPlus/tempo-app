-- Close the launch-critical gaps between external checkout, limited slot
-- inventory, and user-submitted moderation reports.

alter table action_payment_intents
  add column if not exists failure_reason text;

-- A slot must be held before a gateway checkout opens. This keeps an external
-- payment from racing another buyer who completes a wallet purchase first.
create or replace function start_external_slot_payment(
  p_reference text,
  p_kind action_payment_kind,
  p_provider text,
  p_amount_kobo bigint,
  p_slot_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns action_payment_intents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_slot slots%rowtype;
  v_intent action_payment_intents%rowtype;
  v_total bigint;
  v_hold_until timestamptz;
begin
  if v_user is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if exists (select 1 from profiles where id = v_user and suspended) then
    raise exception 'account suspended' using errcode = '42501';
  end if;
  if p_kind not in ('booking', 'host_game') then
    raise exception 'unsupported slot payment' using errcode = 'P0001';
  end if;
  if p_provider not in ('korapay', 'flutterwave') then
    raise exception 'unsupported payment provider' using errcode = 'P0001';
  end if;

  select * into v_slot from slots where id = p_slot_id for update;
  if not found then raise exception 'slot not found' using errcode = 'P0002'; end if;
  if lower(v_slot.during) <= now() then raise exception 'that time has already passed' using errcode = 'P0001'; end if;

  select * into v_intent
    from action_payment_intents
   where slot_id = p_slot_id
     and kind in ('booking', 'host_game')
     and status = 'pending'
   order by created_at desc
   limit 1
   for update;

  if found then
    if v_intent.user_id = v_user and v_intent.provider = p_provider then
      return v_intent;
    end if;
    raise exception 'that slot is already being checked out' using errcode = 'P0001';
  end if;

  if v_slot.status = 'held'
     and v_slot.held_for_user_id = v_user
     and v_slot.held_until > now() then
    v_hold_until := greatest(v_slot.held_until, least(now() + interval '20 minutes', lower(v_slot.during)));
  elsif v_slot.status = 'open' then
    v_hold_until := least(now() + interval '20 minutes', lower(v_slot.during));
  else
    raise exception 'slot is no longer available' using errcode = 'P0001';
  end if;

  v_total := v_slot.price_kobo + round(v_slot.price_kobo * 0.05);
  if p_amount_kobo <> v_total then raise exception 'payment amount mismatch' using errcode = 'P0001'; end if;

  update slots
     set status = 'held', held_for_user_id = v_user, held_until = v_hold_until
   where id = v_slot.id;

  insert into action_payment_intents (
    reference, user_id, kind, provider, amount_kobo, slot_id, payload
  ) values (
    p_reference, v_user, p_kind, p_provider, p_amount_kobo, p_slot_id, coalesce(p_payload, '{}'::jsonb)
  ) returning * into v_intent;

  return v_intent;
end;
$$;

revoke all on function start_external_slot_payment(text, action_payment_kind, text, bigint, uuid, jsonb) from public, anon;
grant execute on function start_external_slot_payment(text, action_payment_kind, text, bigint, uuid, jsonb) to authenticated;

-- Keep the established completion body intact. The wrapper verifies ownership
-- of the hold, then opens it only within this transaction so the legacy
-- implementation can create the final booking or game safely.
alter function complete_action_payment(text, bigint, text, jsonb)
  rename to complete_action_payment_legacy;

create function complete_action_payment(
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
begin
  select * into v_intent from action_payment_intents where reference = p_reference for update;
  if not found then raise exception 'payment intent not found' using errcode = 'P0002'; end if;

  if v_intent.status = 'pending' and v_intent.kind in ('booking', 'host_game') then
    select * into v_slot from slots where id = v_intent.slot_id for update;
    if not found then raise exception 'slot not found' using errcode = 'P0002'; end if;
    if v_slot.status <> 'held'
       or v_slot.held_for_user_id <> v_intent.user_id
       or v_slot.held_until <= now() then
      raise exception 'checkout hold has expired' using errcode = 'P0001';
    end if;

    -- The legacy function validates an open slot. The row lock keeps this
    -- internal transition invisible to other transactions until it books it.
    update slots set status = 'open', held_for_user_id = null, held_until = null where id = v_slot.id;
  end if;

  return complete_action_payment_legacy(p_reference, p_amount_kobo, p_provider_ref, p_raw);
end;
$$;

revoke all on function complete_action_payment(text, bigint, text, jsonb) from public, authenticated, anon;
grant execute on function complete_action_payment(text, bigint, text, jsonb) to service_role;

-- Mark abandoned external checkouts as failed before booking-hold expiry
-- promotes the next waiter or reopens the slot. The slot itself remains for
-- expire_booking_slot_holds() to process so waitlist order is preserved.
create or replace function expire_external_slot_payment_intents()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update action_payment_intents i
     set status = 'failed', failure_reason = 'checkout hold expired', updated_at = now()
    from slots s
   where i.slot_id = s.id
     and i.kind in ('booking', 'host_game')
     and i.status = 'pending'
     and s.status = 'held'
     and s.held_until <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function expire_external_slot_payment_intents() from public, authenticated, anon;
grant execute on function expire_external_slot_payment_intents() to service_role;

-- Reports must identify a real message the reporter can actually see. Do not
-- accept the reported account, context, or quoted text from the browser.
drop policy if exists message_reports_insert_own on message_reports;

create or replace function report_message(
  p_source text,
  p_message_id uuid,
  p_reason text
)
returns message_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporter uuid := auth.uid();
  v_reported_user uuid;
  v_context_id uuid;
  v_snapshot text;
  v_row message_reports%rowtype;
begin
  if v_reporter is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_reason, ''))) not between 1 and 500 then
    raise exception 'tell us what happened' using errcode = 'P0001';
  end if;

  if p_source = 'game_chat' then
    select user_id, game_id, body into v_reported_user, v_context_id, v_snapshot
      from game_chat_messages where id = p_message_id;
    if not found then raise exception 'message not found' using errcode = 'P0002'; end if;
    if not (
      exists (
        select 1 from game_participants gp
         where gp.game_id = v_context_id and gp.user_id = v_reporter
           and gp.status in ('confirmed', 'pending_payment', 'played', 'no_show')
      )
      or exists (select 1 from games g where g.id = v_context_id and g.host_id = v_reporter)
      or is_admin()
    ) then
      raise exception 'not authorized to report this message' using errcode = '42501';
    end if;
  elsif p_source = 'direct_message' then
    select m.sender_id, m.thread_id, m.body into v_reported_user, v_context_id, v_snapshot
      from dm_messages m
      join dm_threads t on t.id = m.thread_id
     where m.id = p_message_id and v_reporter in (t.user_a, t.user_b);
    if not found then raise exception 'message not found' using errcode = 'P0002'; end if;
  else
    raise exception 'invalid report source' using errcode = 'P0001';
  end if;

  if v_reported_user = v_reporter then raise exception 'you cannot report your own message' using errcode = 'P0001'; end if;

  insert into message_reports (reporter_id, reported_user_id, source, context_id, message_snapshot, reason)
  values (v_reporter, v_reported_user, p_source, v_context_id, v_snapshot, btrim(p_reason))
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function report_message(text, uuid, text) from public, anon;
grant execute on function report_message(text, uuid, text) to authenticated;
