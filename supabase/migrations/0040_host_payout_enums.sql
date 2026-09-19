-- New wallet ledger entries are kept separate so Postgres can commit the
-- enum labels before the payout functions in the following migration use them.
alter type wallet_txn_type add value if not exists 'host_withdrawal';
alter type wallet_txn_type add value if not exists 'host_withdrawal_reversal';
