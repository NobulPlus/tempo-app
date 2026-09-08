-- ============================================================================
-- Enum additions for host-funded games.
--
-- Split from the function migration because Postgres enum labels can be
-- awkward to use in the same transaction that creates them. These labels let
-- the wallet ledger distinguish:
--   - host_game_deposit: host paid upfront to reserve the pitch
--   - host_reimbursement: Tempo settled collected player money back to host
-- ============================================================================

alter type wallet_txn_type add value 'host_game_deposit';
alter type wallet_txn_type add value 'host_reimbursement';
