-- Enum additions for player points + host tiers. Split into its own file,
-- same reason as 0011/0040: Postgres won't let a transaction use an enum
-- label it just added, so the functions that reference these live in the
-- next migration.

create type host_tier as enum ('bronze', 'silver', 'gold', 'elite');

alter type wallet_txn_type add value if not exists 'reward_credit';
alter type wallet_txn_type add value if not exists 'host_perk_credit';
