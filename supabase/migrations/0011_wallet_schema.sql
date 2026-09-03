-- ============================================================================
-- Wallet schema. Split from 0012_wallet_functions.sql deliberately — the new
-- enum value below needs to be committed before any function can reference
-- it (Postgres won't let a transaction use an enum label it just added).
--
-- Money never lives on `profiles`. That table has `profiles_read using
-- (true)` — every player's card is public — and 0008/0009 already proved
-- that trying to hide one column of a `using (true)` table with column-level
-- GRANT/REVOKE breaks `select("*")` for everyone (see 0009's comment). A
-- balance is exactly the kind of column that must never end up there, so it
-- gets its own table with owner-only RLS, same pattern 0009 used for phone.
-- ============================================================================

alter type payment_method add value 'wallet';

create type wallet_txn_type   as enum ('topup', 'booking_payment', 'cancellation_credit');
create type wallet_txn_status as enum ('pending', 'completed', 'failed');

-- One row per user. Created lazily (on first credit) by the functions in
-- 0012, not by a trigger — a user with no wallet activity simply has no row,
-- and reads treat that as a zero balance.
create table wallets (
  user_id      uuid primary key references profiles(id) on delete cascade,
  balance_kobo bigint not null default 0 check (balance_kobo >= 0),
  updated_at   timestamptz not null default now()
);

-- The ledger — source of truth for every balance change. `balance_kobo` on
-- `wallets` is a cache of "sum of this table for this user", maintained
-- inside the same transaction as each insert here, same relationship the
-- reputation columns on `profiles` have to game_participants/ratings.
create table wallet_transactions (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid not null references profiles(id) on delete cascade,
  type               wallet_txn_type not null,
  status             wallet_txn_status not null default 'completed',
  -- Signed: positive = credit (topup, cancellation refund), negative = debit
  -- (booking payment).
  amount_kobo        bigint not null,
  balance_after_kobo bigint,
  reference          text unique not null,
  provider           text,
  provider_ref       text,
  booking_id         uuid references bookings(id) on delete set null,
  raw_response       jsonb,
  created_at         timestamptz not null default now()
);

create index wallet_txns_user_idx on wallet_transactions (user_id, created_at desc);

alter table wallets            enable row level security;
alter table wallet_transactions enable row level security;

-- Strictly your own, both tables — no public/host/admin read. No insert,
-- update or delete policy on either: every write goes through a
-- `security definer` function (0012), never a direct client write, exactly
-- the posture `payments_read` already documents ("strictly your own. No
-- public read, ever").
create policy wallets_read on wallets for select using (auth.uid() = user_id);
create policy wallet_txns_read on wallet_transactions for select using (auth.uid() = user_id);
