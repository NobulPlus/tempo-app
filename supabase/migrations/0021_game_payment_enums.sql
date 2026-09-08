-- ============================================================================
-- Enum additions for real wallet payment on hosted games (installment/hold
-- model). Split into its own migration because Postgres won't let a
-- transaction use an enum label it just added in the same transaction --
-- same constraint noted in 0011_wallet_schema.sql's header comment. The
-- functions that reference these values live in a later migration.
-- ============================================================================

alter type participant_status add value 'pending_payment';
alter type wallet_txn_type add value 'game_payment';
alter type wallet_txn_type add value 'game_refund';
