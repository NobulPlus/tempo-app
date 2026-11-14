-- Finish the lifecycle support for host-entered venues and make the two
-- lifetime point milestones redeemable as one-time Tempo credit.

-- A host or admin must be able to manage attendance even when there is no
-- Tempo pitch/venue relationship. Venue owners and their staff still only
-- receive access for games attached to their own Tempo venue.
create or replace function can_manage_game_attendance(p_game_id uuid, p_user uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user <> auth.uid() and not is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return exists (
    select 1
      from games g
      left join pitches p on p.id = g.pitch_id
      left join venues v on v.id = p.venue_id
     where g.id = p_game_id
       and (
         g.host_id = p_user
         or v.owner_id = p_user
         or is_admin()
         or exists (
           select 1 from venue_staff vs
            where vs.venue_id = v.id and vs.user_id = p_user
         )
       )
  );
end;
$$;

grant execute on function can_manage_game_attendance(uuid, uuid) to authenticated;

-- Player-payment holds and stale minimum decisions used inner joins to
-- Tempo pitches. Keep them working for platform games, while using the
-- host-provided name for games held elsewhere.
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
  v_row record;
  v_balance bigint;
  v_ref text;
begin
  for v_row in
    select gp.id as participant_id, gp.game_id as g_id, gp.user_id as u_id, gp.paid_kobo,
           g.title, g.slug, lower(g.during) as kickoff,
           coalesce(v.name, g.venue_name, 'Host-provided venue') as venue_name
      from game_participants gp
      join games g on g.id = gp.game_id
      left join pitches p on p.id = g.pitch_id
      left join venues v on v.id = p.venue_id
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
    select g.id, g.title, g.slug, lower(g.during) as kickoff,
           coalesce(v.name, g.venue_name, 'Host-provided venue') as venue_name,
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
      left join pitches p on p.id = g.pitch_id
      left join venues v on v.id = p.venue_id
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

-- Off-platform hosts do not pay a Tempo pitch deposit, but they still need
-- their collected player fees settled after the game. Platform-hosted games
-- retain the existing host-paid guard.
create or replace function settle_ended_host_games()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game games%rowtype;
  v_collected bigint;
  v_recovery bigint;
  v_earnings bigint;
  v_balance bigint;
  v_count int := 0;
  v_ref text;
begin
  for v_game in
    select * from games
     where upper(during) <= now()
       and status in ('open', 'locked', 'played')
       and minimum_decision_status in ('go_ahead', 'not_needed')
       and (host_paid_kobo > 0 or pitch_id is null)
     for update skip locked
  loop
    select coalesce(sum(paid_kobo), 0) into v_collected
      from game_participants
     where game_id = v_game.id and status in ('confirmed', 'played', 'no_show');
    v_recovery := greatest(0, least(v_collected, v_game.host_pitch_cost_kobo) - v_game.host_reimbursed_kobo);
    v_earnings := greatest(0, (v_collected - v_game.host_pitch_cost_kobo) - v_game.host_earnings_kobo);
    if v_recovery = 0 and v_earnings = 0 then continue; end if;

    insert into wallets (user_id, balance_kobo) values (v_game.host_id, 0) on conflict (user_id) do nothing;
    if v_recovery > 0 then
      update wallets set balance_kobo = balance_kobo + v_recovery, updated_at = now() where user_id = v_game.host_id returning balance_kobo into v_balance;
      update games set host_reimbursed_kobo = host_reimbursed_kobo + v_recovery where id = v_game.id;
      v_ref := 'HRB-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, game_id)
      values (v_game.host_id, 'host_reimbursement', 'completed', v_recovery, v_balance, v_ref, v_game.id);
    end if;
    if v_earnings > 0 then
      update wallets set balance_kobo = balance_kobo + v_earnings, updated_at = now() where user_id = v_game.host_id returning balance_kobo into v_balance;
      update games set host_earnings_kobo = host_earnings_kobo + v_earnings where id = v_game.id;
      v_ref := 'HPE-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference, game_id)
      values (v_game.host_id, 'host_game_earnings', 'completed', v_earnings, v_balance, v_ref, v_game.id);
    end if;
    insert into user_notifications (user_id, kind, title, body, href)
    values (v_game.host_id, 'host_earnings', 'Host earnings settled', 'Your completed game earnings are now available in Tempo credit.', '/wallet');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function settle_ended_host_games() from public, anon, authenticated;
grant execute on function settle_ended_host_games() to service_role;

-- Lifetime points are earned, never spent. These grants are claimable once
-- per account and milestone, serialized with an advisory lock and backed by
-- the unique wallet reference so retries cannot double-credit a player.
create or replace function claim_lifetime_reward(p_milestone int)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_lifetime_points int;
  v_credit_kobo bigint;
  v_reference text;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from profiles where id = v_user and suspended) then
    raise exception 'account suspended' using errcode = '42501';
  end if;
  if p_milestone not in (1000, 3000) then
    raise exception 'unknown lifetime milestone' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user::text));
  v_reference := 'lifetime-reward:' || v_user::text || ':' || p_milestone::text;

  if exists (select 1 from wallet_transactions where reference = v_reference) then
    return 0;
  end if;

  select coalesce(sum(points) filter (where points > 0), 0) into v_lifetime_points
    from player_point_entries
   where user_id = v_user;
  if v_lifetime_points < p_milestone then
    raise exception 'lifetime milestone not reached' using errcode = 'P0001';
  end if;

  v_credit_kobo := case p_milestone
    when 1000 then 1000000
    when 3000 then 3000000
  end;

  perform credit_wallet(
    v_user,
    v_credit_kobo,
    'reward_credit',
    v_reference,
    p_milestone::text || '-point lifetime reward'
  );

  insert into user_notifications (user_id, kind, title, body, href)
  values (
    v_user,
    'reward_earned',
    'Lifetime reward unlocked',
    'Your ' || p_milestone::text || '-point reward is now in your Tempo credit.',
    '/wallet'
  );

  return v_credit_kobo;
end;
$$;

revoke all on function claim_lifetime_reward(int) from public, anon;
grant execute on function claim_lifetime_reward(int) to authenticated;
