-- ============================================================================
-- Schema additions + RLS hardening for real wallet payment on hosted games.
--
-- Why the RLS tightening: games_update / participants_insert /
-- participants_update (0001_init.sql) never had a `with check`, so a client
-- could write game_participants.status/paid_kobo or games.status directly
-- via PostgREST, bypassing every RPC. That was low-stakes when nothing cost
-- money; it isn't anymore. From here on, every mutation to these two tables
-- goes exclusively through security definer RPCs (join_game/leave_game/
-- host_game/pay_game_balance/cancel_game) — the same posture
-- wallets/wallet_transactions/payments already have (zero direct-write
-- policies). Reads stay public.
-- ============================================================================

alter table game_participants add column payment_deadline timestamptz;

alter table wallet_transactions
  add column game_id uuid references games(id) on delete set null;

drop policy if exists games_insert on games;
drop policy if exists games_update on games;
drop policy if exists participants_insert on game_participants;
drop policy if exists participants_update on game_participants;
