-- ============================================================================
-- Hardens the host-funded game lifecycle:
-- - cancelled games clear active participant/payment-hold state after refund
-- - hold expiry ignores cancelled/non-active games
-- - direct cancellation has an RPC that returns an authoritative refund summary
-- - minimum decisions are only host-callable once the deadline has arrived
-- - host reimbursement settles after the game ends, not at kickoff
-- - a service-role cron can cancel stale below-minimum games after a grace window
-- ============================================================================

create table if not exists game_cancellation_refunds (
  id uuid primary key default uuid_generate_v4(),
  game_id uuid not null references games(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  amount_kobo bigint not null check (amount_kobo >= 0),
  created_at timestamptz not null default now(),
  notified_at timestamptz,

  unique (game_id, user_id)
);

create index if not exists game_cancellation_refunds_game_idx
  on game_cancellation_refunds (game_id, created_at);

create index if not exists game_cancellation_refunds_pending_notify_idx
  on game_cancellation_refunds (game_id)
  where notified_at is null;

alter table game_cancellation_refunds enable row level security;

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

  -- Cancellation is terminal for participation. This prevents later reminder
  -- or unpaid-hold jobs from seeing stale confirmed/pending rows.
  update game_participants
     set status = 'withdrawn',
         payment_deadline = null,
         reminder_1h_sent_at = null,
         reminder_30m_sent_at = null
   where game_id = p_game_id
     and status in ('confirmed', 'pending_payment', 'waitlist');

  v_host_refund := greatest(0, v_game.host_paid_kobo - v_game.host_reimbursed_kobo);
  if v_host_refund > 0 and lower(v_game.during) - now() >= interval '6 hours' then
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
  v_cancelled games%rowtype;
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

  select count(*)::int, coalesce(sum(paid_kobo), 0)
    into player_refunded_count, player_refunded_kobo
    from game_participants
   where game_id = p_game_id
     and status in ('confirmed', 'pending_payment')
     and paid_kobo > 0;

  host_refunded_kobo := case
    when lower(v_game.during) - now() >= interval '6 hours'
      then greatest(0, v_game.host_paid_kobo - v_game.host_reimbursed_kobo)
    else 0
  end;

  v_cancelled := cancel_game_internal(p_game_id);
  game_status := v_cancelled.status;
  minimum_decision_status := v_cancelled.minimum_decision_status;
  return next;
end;
$$;

grant execute on function cancel_game_with_summary(uuid) to authenticated;

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

  if not is_admin() and coalesce(v_game.minimum_decision_deadline, lower(v_game.during)) > now() then
    raise exception 'minimum decision is not due yet' using errcode = 'P0001';
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
  if upper(v_game.during) > now() then
    raise exception 'game has not ended yet' using errcode = 'P0001';
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
    where wallets.user_id = v_game.host_id
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
       and g.status in ('open', 'locked')
     for update of gp
  loop
    update game_participants
       set status = 'withdrawn',
           payment_deadline = null
     where id = v_row.participant_id;

    if v_row.paid_kobo > 0 then
      insert into wallets (user_id, balance_kobo) values (v_row.u_id, 0)
        on conflict (user_id) do nothing;

      update wallets set balance_kobo = balance_kobo + v_row.paid_kobo, updated_at = now()
        where wallets.user_id = v_row.u_id
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

create or replace function expire_stale_minimum_decisions()
returns table (
  game_id uuid,
  game_title text,
  game_slug text,
  venue_name text,
  kickoff_at timestamptz,
  player_refunded_count int,
  player_refunded_kobo bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  for v_row in
    select g.id, g.title, g.slug, lower(g.during) as kickoff, v.name as venue_name,
           (
             select count(*)::int
               from game_participants gp
              where gp.game_id = g.id
                and gp.status in ('confirmed', 'pending_payment')
                and gp.paid_kobo > 0
           ) as refunded_count,
           (
             select coalesce(sum(gp.paid_kobo), 0)
               from game_participants gp
              where gp.game_id = g.id
                and gp.status in ('confirmed', 'pending_payment')
                and gp.paid_kobo > 0
           ) as refunded_kobo
      from games g
      join pitches p on p.id = g.pitch_id
      join venues v on v.id = p.venue_id
     where g.status in ('open', 'locked')
       and g.minimum_decision_status = 'pending'
       and coalesce(g.minimum_decision_deadline, lower(g.during)) + interval '2 hours' <= now()
       and lower(g.during) > now()
       and (
         select count(*)
           from game_participants gp
          where gp.game_id = g.id
            and gp.status in ('confirmed', 'pending_payment')
       ) < g.minimum_to_guarantee
     for update of g
  loop
    perform cancel_game_internal(v_row.id);

    game_id := v_row.id;
    game_title := v_row.title;
    game_slug := v_row.slug;
    venue_name := v_row.venue_name;
    kickoff_at := v_row.kickoff;
    player_refunded_count := v_row.refunded_count;
    player_refunded_kobo := v_row.refunded_kobo;
    return next;
  end loop;
end;
$$;

revoke all on function expire_stale_minimum_decisions() from public;
revoke all on function expire_stale_minimum_decisions() from authenticated;
revoke all on function expire_stale_minimum_decisions() from anon;
grant execute on function expire_stale_minimum_decisions() to service_role;
