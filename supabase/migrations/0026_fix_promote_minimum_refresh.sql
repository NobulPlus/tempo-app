-- ============================================================================
-- Fixes a gap in promote_next_waitlisted() from 0025_host_funded_game_flow.sql:
-- the "nobody on the waitlist" branch returned before calling
-- refresh_game_minimum_status(), so a game that had already reached
-- 'not_needed' and then lost a participant (an expired unpaid hold, with no
-- one waiting to take the spot) never got its minimum_decision_status
-- reverted to 'pending'. settle_game_host_reimbursement() gates specifically
-- on that stored status ('go_ahead'/'not_needed'), so a stale 'not_needed'
-- could let a host claim reimbursement on a game that quietly dropped back
-- below minimum without ever being re-decided.
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
    perform refresh_game_minimum_status(p_game_id);
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

  perform refresh_game_minimum_status(p_game_id);
end;
$$;

revoke all on function promote_next_waitlisted(uuid) from public;
revoke all on function promote_next_waitlisted(uuid) from authenticated;
revoke all on function promote_next_waitlisted(uuid) from anon;
