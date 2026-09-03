-- ============================================================================
-- SECURITY FIX: complete_wallet_topup() was callable by any authenticated
-- (and even anon) user, not just service_role as intended.
--
-- Postgres grants EXECUTE on a newly created function to PUBLIC by default —
-- an explicit `grant ... to service_role` in 0012 added that role, but never
-- revoked the implicit PUBLIC grant sitting underneath it. Confirmed
-- exploitable directly against this database: an authenticated user's own
-- session could call complete_wallet_topup() with a reference from their own
-- initiate_wallet_topup() call, no payment required, no Flutterwave
-- verification involved — free wallet credit.
--
-- create_booking()/cancel_booking()/initiate_wallet_topup() don't have this
-- problem despite the same default grant, because each checks `auth.uid()`
-- internally and rejects a null/mismatched caller on its own merits.
-- complete_wallet_topup() has no such check — its entire security model IS
-- the grant, so the grant has to actually be exclusive.
-- ============================================================================

revoke all on function complete_wallet_topup(text, text, jsonb) from public;
revoke all on function complete_wallet_topup(text, text, jsonb) from authenticated;
revoke all on function complete_wallet_topup(text, text, jsonb) from anon;
grant execute on function complete_wallet_topup(text, text, jsonb) to service_role;
