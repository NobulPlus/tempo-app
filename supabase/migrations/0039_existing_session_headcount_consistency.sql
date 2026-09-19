-- Keep existing-session regulars in the same headcount used by every game
-- lifecycle decision. They are real attendees, but do not have Tempo
-- participant rows because they joined outside the marketplace.

create or replace function refresh_game_minimum_status(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game games%rowtype;
  v_count int;
begin
  select * into v_game from games where id = p_game_id for update;
  if not found or v_game.status not in ('open', 'locked') then
    return;
  end if;

  select coalesce(v_game.preconfirmed_player_count, 0) + count(*) into v_count
    from game_participants
   where game_id = p_game_id
     and status in ('confirmed', 'pending_payment');

  if v_count >= v_game.minimum_to_guarantee then
    update games set minimum_decision_status = 'not_needed'
     where id = p_game_id and minimum_decision_status = 'pending';
  elsif v_game.minimum_decision_status = 'not_needed' then
    update games set minimum_decision_status = 'pending'
     where id = p_game_id;
  end if;
end;
$$;

create or replace function join_game(p_game_id uuid)
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
  v_balance bigint;
  v_charge bigint := 0;
  v_ref text;
begin
  if v_user is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if exists (select 1 from profiles where id = v_user and suspended) then raise exception 'account suspended' using errcode = '42501'; end if;

  select * into v_game from games where id = p_game_id for update;
  if not found then raise exception 'game not found' using errcode = 'P0002'; end if;
  if v_game.status not in ('open', 'locked') then raise exception 'game is not open' using errcode = 'P0001'; end if;
  if lower(v_game.during) <= now() then raise exception 'game has already started' using errcode = 'P0001'; end if;
  if exists (select 1 from game_participants where game_id = p_game_id and user_id = v_user and status <> 'withdrawn') then
    raise exception 'already a participant in this game' using errcode = 'P0001';
  end if;

  select coalesce(v_game.preconfirmed_player_count, 0) + count(*) into v_count
    from game_participants
   where game_id = p_game_id and status in ('confirmed', 'pending_payment');
  v_status := case when v_count >= v_game.capacity then 'waitlist' else 'confirmed' end;

  if v_status = 'confirmed' and v_game.price_per_player_kobo > 0 then
    insert into wallets (user_id, balance_kobo) values (v_user, 0) on conflict (user_id) do nothing;
    select balance_kobo into v_balance from wallets where user_id = v_user for update;
    v_charge := least(v_balance, v_game.price_per_player_kobo);
    if v_charge > 0 then
      update wallets set balance_kobo = balance_kobo - v_charge, updated_at = now() where user_id = v_user;
      v_ref := 'GPY-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, game_id)
      values (v_user, 'game_payment', 'completed', -v_charge, v_balance - v_charge, v_ref, p_game_id);
    end if;
    if v_charge < v_game.price_per_player_kobo then v_status := 'pending_payment'; end if;
  end if;

  insert into game_participants (game_id, user_id, status, paid_kobo, payment_deadline)
  values (p_game_id, v_user, v_status, v_charge,
    case when v_status = 'pending_payment' then least(now() + interval '48 hours', lower(v_game.during) - interval '2 hours') else null end)
  on conflict (game_id, user_id) do update
    set status = case when game_participants.status = 'withdrawn' then excluded.status else game_participants.status end,
        paid_kobo = case when game_participants.status = 'withdrawn' then excluded.paid_kobo else game_participants.paid_kobo end,
        payment_deadline = case when game_participants.status = 'withdrawn' then excluded.payment_deadline else game_participants.payment_deadline end
  returning * into v_row;

  if v_status in ('confirmed', 'pending_payment') and v_count + 1 >= v_game.capacity then
    update games set status = 'locked' where id = p_game_id;
  end if;
  if v_status in ('confirmed', 'pending_payment') then perform refresh_game_minimum_status(p_game_id); end if;
  return v_row;
end;
$$;

create or replace function promote_next_waitlisted(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game games%rowtype;
  v_next game_participants%rowtype;
  v_count int;
  v_balance bigint;
  v_charge bigint := 0;
  v_status participant_status := 'confirmed';
  v_ref text;
begin
  select * into v_game from games where id = p_game_id for update;
  if not found then return; end if;

  select coalesce(v_game.preconfirmed_player_count, 0) + count(*) into v_count
    from game_participants
   where game_id = p_game_id and status in ('confirmed', 'pending_payment');
  if v_count >= v_game.capacity then
    update games set status = 'locked' where id = p_game_id and status = 'open';
    perform refresh_game_minimum_status(p_game_id);
    return;
  end if;

  select * into v_next from game_participants
   where game_id = p_game_id and status = 'waitlist'
   order by joined_at limit 1 for update;
  if not found then
    update games set status = 'open' where id = p_game_id and status = 'locked';
    perform refresh_game_minimum_status(p_game_id);
    return;
  end if;

  if v_game.price_per_player_kobo > 0 then
    insert into wallets (user_id, balance_kobo) values (v_next.user_id, 0) on conflict (user_id) do nothing;
    select balance_kobo into v_balance from wallets where user_id = v_next.user_id for update;
    v_charge := least(v_balance, v_game.price_per_player_kobo);
    if v_charge > 0 then
      update wallets set balance_kobo = balance_kobo - v_charge, updated_at = now() where user_id = v_next.user_id;
      v_ref := 'GPY-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, game_id)
      values (v_next.user_id, 'game_payment', 'completed', -v_charge, v_balance - v_charge, v_ref, p_game_id);
    end if;
    if v_charge < v_game.price_per_player_kobo then v_status := 'pending_payment'; end if;
  end if;

  update game_participants set status = v_status, paid_kobo = v_charge,
    payment_deadline = case when v_status = 'pending_payment' then least(now() + interval '48 hours', lower(v_game.during) - interval '2 hours') else null end
   where id = v_next.id;
  if v_count + 1 >= v_game.capacity then update games set status = 'locked' where id = p_game_id; end if;
  perform refresh_game_minimum_status(p_game_id);
end;
$$;

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
  if v_user is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_decision not in ('go_ahead', 'cancel') then raise exception 'unknown decision' using errcode = 'P0001'; end if;
  select * into v_game from games where id = p_game_id for update;
  if not found then raise exception 'game not found' using errcode = 'P0002'; end if;
  if v_game.host_id <> v_user and not is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  if v_game.status not in ('open', 'locked') then raise exception 'game cannot be decided' using errcode = 'P0001'; end if;
  if lower(v_game.during) <= now() then raise exception 'game has already started' using errcode = 'P0001'; end if;

  select coalesce(v_game.preconfirmed_player_count, 0) + count(*) into v_count
    from game_participants
   where game_id = p_game_id and status in ('confirmed', 'pending_payment');
  if v_count >= v_game.minimum_to_guarantee then
    update games set minimum_decision_status = 'not_needed' where id = p_game_id;
    select * into v_game from games where id = p_game_id;
    return v_game;
  end if;
  if p_decision = 'cancel' then return cancel_game_internal(p_game_id); end if;
  update games set minimum_decision_status = 'go_ahead' where id = p_game_id;
  select * into v_game from games where id = p_game_id;
  return v_game;
end;
$$;

grant execute on function join_game(uuid) to authenticated;
grant execute on function decide_game_minimum(uuid, text) to authenticated;
revoke all on function refresh_game_minimum_status(uuid) from public;
revoke all on function refresh_game_minimum_status(uuid) from authenticated;
revoke all on function refresh_game_minimum_status(uuid) from anon;
revoke all on function promote_next_waitlisted(uuid) from public;
revoke all on function promote_next_waitlisted(uuid) from authenticated;
revoke all on function promote_next_waitlisted(uuid) from anon;

-- Bring already-published existing sessions into the corrected minimum state.
update games g
   set minimum_decision_status = 'not_needed'
 where g.status in ('open', 'locked')
   and g.minimum_decision_status = 'pending'
   and coalesce(g.preconfirmed_player_count, 0) + (
     select count(*)
       from game_participants gp
      where gp.game_id = g.id
        and gp.status in ('confirmed', 'pending_payment')
   ) >= g.minimum_to_guarantee;
