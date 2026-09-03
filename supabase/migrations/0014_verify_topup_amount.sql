-- ============================================================================
-- SECURITY FIX: require the verified Flutterwave amount to match the pending
-- wallet top-up before crediting balance.
--
-- Flutterwave's guidance is to verify status, currency, tx_ref and amount
-- before giving value. The app already verified status/currency/reference in
-- TypeScript; this moves the amount check into the database trust boundary so
-- a caller cannot accidentally complete a reference for a different amount.
-- ============================================================================

revoke all on function complete_wallet_topup(text, text, jsonb) from public;
revoke all on function complete_wallet_topup(text, text, jsonb) from authenticated;
revoke all on function complete_wallet_topup(text, text, jsonb) from anon;
revoke all on function complete_wallet_topup(text, text, jsonb) from service_role;
drop function if exists complete_wallet_topup(text, text, jsonb);

create or replace function complete_wallet_topup(
  p_reference     text,
  p_amount_kobo   bigint,
  p_provider_ref  text,
  p_raw           jsonb
)
returns wallet_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn     wallet_transactions%rowtype;
  v_balance bigint;
begin
  select * into v_txn from wallet_transactions where reference = p_reference for update;

  if not found then
    raise exception 'unknown topup reference' using errcode = 'P0002';
  end if;
  if v_txn.type <> 'topup' then
    raise exception 'reference is not a wallet top-up' using errcode = 'P0001';
  end if;
  if v_txn.status = 'completed' then
    return v_txn;
  end if;
  if v_txn.status <> 'pending' then
    raise exception 'topup is in an unexpected state' using errcode = 'P0001';
  end if;
  if v_txn.amount_kobo <> p_amount_kobo then
    raise exception 'topup amount mismatch' using errcode = 'P0001';
  end if;

  insert into wallets (user_id, balance_kobo) values (v_txn.user_id, 0)
    on conflict (user_id) do nothing;

  update wallets
     set balance_kobo = balance_kobo + v_txn.amount_kobo, updated_at = now()
   where user_id = v_txn.user_id
   returning balance_kobo into v_balance;

  update wallet_transactions
     set status = 'completed', balance_after_kobo = v_balance, provider_ref = p_provider_ref, raw_response = p_raw
   where reference = p_reference
   returning * into v_txn;

  return v_txn;
end;
$$;

revoke all on function complete_wallet_topup(text, bigint, text, jsonb) from public;
revoke all on function complete_wallet_topup(text, bigint, text, jsonb) from authenticated;
revoke all on function complete_wallet_topup(text, bigint, text, jsonb) from anon;
grant execute on function complete_wallet_topup(text, bigint, text, jsonb) to service_role;
