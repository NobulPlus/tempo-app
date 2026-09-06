-- ============================================================================
-- Unlocks admin read access to wallet data for the finance console.
--
-- 0011_wallet_schema.sql deliberately gave wallets/wallet_transactions only
-- a self-read policy ("no public/host/admin read") — at the time there was
-- no admin finance surface to justify wider access. That surface now
-- exists, so this adds the same is_admin() bypass pattern already used for
-- venues/bookings/payments (venues_admin_all, bookings_admin_all,
-- payments_admin_all, all from 0002_auth_hardening.sql) — read-only, no
-- admin write policy, since this pass is read-only visibility by design.
-- ============================================================================

create policy wallets_admin_read on wallets for select using (is_admin());
create policy wallet_txns_admin_read on wallet_transactions for select using (is_admin());
