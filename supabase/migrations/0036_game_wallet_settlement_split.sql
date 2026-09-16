-- Make hosted-game money explicit.
--
-- The host pays the pitch price plus Tempo's booking fee up front. Player
-- payments first recover the pitch price, then become host earnings. The
-- booking fee is Tempo revenue and is never treated as host earnings.

alter type wallet_txn_type add value if not exists 'host_game_earnings';

alter table games
  add column if not exists host_pitch_cost_kobo bigint not null default 0
    check (host_pitch_cost_kobo >= 0),
  add column if not exists host_booking_fee_kobo bigint not null default 0
    check (host_booking_fee_kobo >= 0),
  add column if not exists host_earnings_kobo bigint not null default 0
    check (host_earnings_kobo >= 0);

-- Existing games already have a game settlement and a host deposit. Use those
-- records to reconstruct the original pitch/fee split without changing money.
update games g
   set host_pitch_cost_kobo = coalesce(
         (select vs.gross_kobo from venue_settlements vs where vs.game_id = g.id),
         0
       ),
       host_booking_fee_kobo = greatest(
         0,
         g.host_paid_kobo - coalesce(
           (select vs.gross_kobo from venue_settlements vs where vs.game_id = g.id),
           0
         )
       )
 where g.host_paid_kobo > 0
   and g.host_pitch_cost_kobo = 0;

-- Keep new game rows correct even if a future write path forgets to populate
-- the derived split. The authoritative amount remains the slot price.
create or replace function populate_game_host_costs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pitch_cost bigint;
begin
  if new.host_paid_kobo > 0 and new.host_pitch_cost_kobo = 0 then
    select price_kobo into v_pitch_cost
      from slots
     where pitch_id = new.pitch_id
       and during = new.during
     limit 1;
    new.host_pitch_cost_kobo := coalesce(v_pitch_cost, new.host_paid_kobo);
    new.host_booking_fee_kobo := greatest(0, new.host_paid_kobo - new.host_pitch_cost_kobo);
  end if;
  return new;
end;
$$;

drop trigger if exists populate_game_host_costs_before_insert on games;
create trigger populate_game_host_costs_before_insert
before insert on games
for each row execute function populate_game_host_costs();

revoke all on function populate_game_host_costs() from public;
revoke all on function populate_game_host_costs() from authenticated;
revoke all on function populate_game_host_costs() from anon;

-- A host can recover only the pitch cost. Any player money above that amount
-- is recorded separately as organizer earnings. Both credits are idempotent
-- because the game counters are advanced in the same locked transaction.
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
  v_recovery_due bigint;
  v_earnings_due bigint;
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

  v_recovery_due := greatest(
    0,
    least(v_collected, v_game.host_pitch_cost_kobo) - v_game.host_reimbursed_kobo
  );
  v_earnings_due := greatest(
    0,
    (v_collected - v_game.host_pitch_cost_kobo) - v_game.host_earnings_kobo
  );

  if v_recovery_due > 0 then
    insert into wallets (user_id, balance_kobo) values (v_game.host_id, 0)
      on conflict (user_id) do nothing;
    update wallets set balance_kobo = balance_kobo + v_recovery_due, updated_at = now()
      where user_id = v_game.host_id
      returning balance_kobo into v_balance;
    update games set host_reimbursed_kobo = host_reimbursed_kobo + v_recovery_due
      where id = p_game_id returning * into v_game;
    v_ref := 'HRB-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, game_id)
    values (v_game.host_id, 'host_reimbursement', 'completed', v_recovery_due, v_balance, v_ref, p_game_id);
  end if;

  if v_earnings_due > 0 then
    insert into wallets (user_id, balance_kobo) values (v_game.host_id, 0)
      on conflict (user_id) do nothing;
    update wallets set balance_kobo = balance_kobo + v_earnings_due, updated_at = now()
      where user_id = v_game.host_id
      returning balance_kobo into v_balance;
    update games set host_earnings_kobo = host_earnings_kobo + v_earnings_due
      where id = p_game_id returning * into v_game;
    v_ref := 'HPE-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, game_id)
    values (v_game.host_id, 'host_game_earnings', 'completed', v_earnings_due, v_balance, v_ref, p_game_id);
  end if;

  select * into v_game from games where id = p_game_id;
  return v_game;
end;
$$;

grant execute on function settle_game_host_reimbursement(uuid) to authenticated;
