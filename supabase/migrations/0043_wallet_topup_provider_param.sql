-- initiate_wallet_topup() hardcoded provider='flutterwave' at insert time; the
-- app then patched the row afterward with a raw, unchecked admin-client
-- .update() to set the real provider (korapay/flutterwave). If that second
-- call ever silently failed, a Korapay top-up stayed mislabeled as
-- 'flutterwave' and became invisible to the payment-reconciliation cron
-- (which filters .eq("provider", "korapay")). Fixes this by taking the
-- provider as a real parameter, validated against the same two values
-- action_payment_intents.provider already enforces, and setting it in the
-- same insert — no separate patch step, nothing to silently fail.
drop function if exists initiate_wallet_topup(text, bigint);

create or replace function initiate_wallet_topup(p_reference text, p_amount_kobo bigint, p_provider text)
returns wallet_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_txn  wallet_transactions%rowtype;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from profiles where id = v_user and suspended) then
    raise exception 'account suspended' using errcode = '42501';
  end if;
  if p_amount_kobo <= 0 then
    raise exception 'invalid amount' using errcode = 'P0001';
  end if;
  if p_provider not in ('korapay', 'flutterwave') then
    raise exception 'invalid provider' using errcode = 'P0001';
  end if;

  insert into wallet_transactions (user_id, type, status, amount_kobo, reference, provider)
  values (v_user, 'topup', 'pending', p_amount_kobo, p_reference, p_provider)
  returning * into v_txn;

  return v_txn;
end;
$$;

grant execute on function initiate_wallet_topup(text, bigint, text) to authenticated;
