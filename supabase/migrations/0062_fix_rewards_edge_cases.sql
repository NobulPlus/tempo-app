-- Three real gaps found on review of 0061, before this shipped anywhere
-- beyond staging:
--
-- 1. redeem_points() read the monthly balance and inserted the negative
--    entry with no locking — two simultaneous redemptions could both read
--    the same balance before either committed, double-spending points.
--    Every other money-reading-then-writing function in this codebase
--    uses `for update` on a row that's guaranteed to exist (wallets,
--    slots, bookings); points have no such row until first earned, so
--    this uses a transaction-scoped advisory lock keyed on the user
--    instead, serializing concurrent calls for the same user.
-- 2. recompute_all_host_tiers() only ever looked at hosts with a game in
--    the last 35 days — a host who reaches Gold/Elite and then goes fully
--    dormant (zero hosted games for 35+ days) was never re-included in
--    the loop, so their tier stayed frozen at its last-computed value
--    forever instead of decaying back to bronze.
-- 3. No notification was ever actually sent on tier promotion — the kind
--    and icon were added in 0061/notification-bell.tsx but nothing
--    triggered it. SQL can't call the TS notification helper directly, so
--    recompute_all_host_tiers() now returns the set of users who were
--    actually promoted (tier increased, not just changed), and the
--    calling cron route sends the notification per row.

create or replace function host_tier_rank(t host_tier)
returns int
language sql
immutable
as $$
  select case t when 'bronze' then 0 when 'silver' then 1 when 'gold' then 2 when 'elite' then 3 end;
$$;

create or replace function redeem_points(p_user uuid, p_points_cost int)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_monthly_balance int;
  v_credit_kobo bigint;
begin
  if v_actor is null or v_actor <> p_user then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if exists (select 1 from profiles where id = p_user and suspended) then
    raise exception 'account suspended' using errcode = '42501';
  end if;

  if p_points_cost not in (100, 250, 500, 1000) then
    raise exception 'unknown reward tier' using errcode = 'P0001';
  end if;

  -- Serializes concurrent redemption attempts for the same user — see the
  -- file header. Released automatically at transaction end.
  perform pg_advisory_xact_lock(hashtext(p_user::text));

  select coalesce(sum(points), 0) into v_monthly_balance
    from player_point_entries
   where user_id = p_user
     and date_trunc('month', created_at) = date_trunc('month', now());

  if v_monthly_balance < p_points_cost then
    raise exception 'not enough points this month' using errcode = 'P0001';
  end if;

  v_credit_kobo := case p_points_cost
    when 100  then 1050000  -- ~35% off a typical session
    when 250  then 2500000  -- free off-peak session
    when 500  then 3500000  -- free any-time session
    when 1000 then 5000000  -- free session + a month of Silver-equivalent value
  end;

  perform award_points(p_user, -p_points_cost, 'redemption', null);
  perform credit_wallet(
    p_user, v_credit_kobo, 'reward_credit',
    'reward-redemption:' || p_user::text || ':' || gen_random_uuid()::text,
    p_points_cost::text || '-point reward redeemed'
  );

  return v_credit_kobo;
end;
$$;

-- Return type is changing (int -> table), which CREATE OR REPLACE can't do.
drop function if exists recompute_all_host_tiers();

create function recompute_all_host_tiers()
returns table (user_id uuid, new_tier host_tier)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_old_tier host_tier;
  v_new_tier host_tier;
begin
  for v_user in
    select id from profiles
     where host_tier <> 'bronze'
        or id in (select distinct host_id from games where lower(during) >= now() - interval '35 days')
  loop
    select host_tier into v_old_tier from profiles where id = v_user;
    v_new_tier := recompute_host_tier(v_user);
    if host_tier_rank(v_new_tier) > host_tier_rank(v_old_tier) then
      user_id := v_user;
      new_tier := v_new_tier;
      return next;
    end if;
  end loop;
  return;
end;
$$;

revoke all on function recompute_all_host_tiers() from public;
revoke all on function recompute_all_host_tiers() from authenticated;
revoke all on function recompute_all_host_tiers() from anon;
grant execute on function recompute_all_host_tiers() to service_role;
