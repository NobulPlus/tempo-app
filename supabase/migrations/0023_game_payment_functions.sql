-- ============================================================================
-- Real wallet payment for hosted games.
--
-- join_game() now actually charges the player: if their wallet balance
-- can't cover price_per_player_kobo in full, they still get the spot,
-- charged whatever's available, and land in 'pending_payment' with a
-- deadline to top up the rest (pay_game_balance()). A hold occupies a real
-- spot, so capacity counting includes 'pending_payment' alongside
-- 'confirmed' everywhere. Free games (price = 0) behave exactly as before.
--
-- leave_game() now also refunds — same 6-hour-before-kickoff cutoff
-- cancel_booking() already uses for direct bookings, applied here for
-- consistency: a player backing out of a paid spot with real notice gets
-- their money back, same as a booking cancellation would.
--
-- cancel_game() is net new (game_status already had an unused 'cancelled'
-- value) — host or admin can call it off entirely, which refunds every
-- paid/held participant regardless of the 6-hour cutoff (this isn't a
-- player backing out, it's the game itself being called off) and reopens
-- the underlying pitch slot.
--
-- promote_next_waitlisted() factors out "pull the next waitlisted player
-- in and try to charge them" since it's now needed both when someone
-- leaves and when a payment hold expires unpaid.
--
-- expire_unpaid_game_holds() is the service-role-only function the new
-- cron route calls on a timer — same explicit revoke-then-grant pattern
-- complete_wallet_topup() uses, so it can't accidentally end up
-- PUBLIC-executable (the exact class of bug fixed in 0013).
--
-- All money movement follows the same shape as cancel_booking()/
-- create_booking(): lock the relevant row(s) `for update`, lazily create a
-- wallets row (`on conflict (user_id) do nothing`), debit/credit
-- balance_kobo, write a signed wallet_transactions ledger row. Same
-- error-code convention: 42501 not-authenticated/suspended, P0002
-- not-found, P0001 business-rule violation.
-- ============================================================================

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
end;
$$;

revoke all on function promote_next_waitlisted(uuid) from public;
revoke all on function promote_next_waitlisted(uuid) from authenticated;
revoke all on function promote_next_waitlisted(uuid) from anon;

-- ----------------------------------------------------------------------------

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

  -- Charging happens below, before the insert/on-conflict resolves — an
  -- already-active participant calling this again would otherwise be
  -- charged a second time with no participant-row update to show for it
  -- (the on-conflict branch only writes new values when the existing row
  -- is 'withdrawn'). Reject the double-call outright instead.
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

  return v_row;
end;
$$;

-- ----------------------------------------------------------------------------

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

  return v_row;
end;
$$;

grant execute on function pay_game_balance(uuid) to authenticated;

-- ----------------------------------------------------------------------------

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
end;
$$;

-- ----------------------------------------------------------------------------

create or replace function cancel_game(p_game_id uuid)
returns games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_game    games%rowtype;
  v_p       record;
  v_balance bigint;
  v_ref     text;
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
  if v_game.status not in ('open', 'locked') then
    raise exception 'game cannot be cancelled' using errcode = 'P0001';
  end if;
  if lower(v_game.during) <= now() then
    raise exception 'game has already started' using errcode = 'P0001';
  end if;

  update games set status = 'cancelled' where id = p_game_id;

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

  select * into v_game from games where id = p_game_id;
  return v_game;
end;
$$;

grant execute on function cancel_game(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Service-role only: called by the game-payment-holds cron route.

create or replace function expire_unpaid_game_holds()
returns table (
  game_id uuid,
  user_id uuid,
  refunded_kobo bigint,
  game_title text,
  game_slug text,
  venue_name text,
  kickoff_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row     record;
  v_balance bigint;
  v_ref     text;
begin
  for v_row in
    select gp.id as participant_id, gp.game_id as g_id, gp.user_id as u_id, gp.paid_kobo,
           g.title, g.slug, lower(g.during) as kickoff, v.name as venue_name
      from game_participants gp
      join games g on g.id = gp.game_id
      join pitches p on p.id = g.pitch_id
      join venues v on v.id = p.venue_id
     where gp.status = 'pending_payment'
       and gp.payment_deadline < now()
     for update of gp
  loop
    update game_participants set status = 'withdrawn' where id = v_row.participant_id;

    if v_row.paid_kobo > 0 then
      insert into wallets (user_id, balance_kobo) values (v_row.u_id, 0)
        on conflict (user_id) do nothing;

      update wallets set balance_kobo = balance_kobo + v_row.paid_kobo, updated_at = now()
        where user_id = v_row.u_id
        returning balance_kobo into v_balance;

      v_ref := 'GRF-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

      insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, game_id)
      values (v_row.u_id, 'game_refund', 'completed', v_row.paid_kobo, v_balance, v_ref, v_row.g_id);
    end if;

    perform promote_next_waitlisted(v_row.g_id);

    game_id := v_row.g_id;
    user_id := v_row.u_id;
    refunded_kobo := v_row.paid_kobo;
    game_title := v_row.title;
    game_slug := v_row.slug;
    venue_name := v_row.venue_name;
    kickoff_at := v_row.kickoff;
    return next;
  end loop;
end;
$$;

revoke all on function expire_unpaid_game_holds() from public;
revoke all on function expire_unpaid_game_holds() from authenticated;
revoke all on function expire_unpaid_game_holds() from anon;
grant execute on function expire_unpaid_game_holds() to service_role;
