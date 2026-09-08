-- ============================================================================
-- Fixes a real bug in expire_unpaid_game_holds() (0023_game_payment_functions.sql):
-- its own `returns table (..., user_id uuid, ...)` output column is an
-- implicit PL/pgSQL variable in scope for the whole function body, and the
-- refund step's `update wallets ... where user_id = v_row.u_id` referenced
-- `user_id` unqualified — ambiguous between that variable and wallets.user_id.
-- Postgres rejected the query outright: "column reference \"user_id\" is
-- ambiguous". That meant the cron could never actually refund anyone with
-- paid_kobo > 0 on an expired hold, i.e. the common case. Caught via a live
-- verification script against the real database, not a hunch.
-- ============================================================================

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
