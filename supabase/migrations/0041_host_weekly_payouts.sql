-- Weekly host payout requests. Bank transfers are executed manually by Tempo
-- operations for now; this keeps a complete, auditable record until a
-- provider transfer integration is introduced.

create table host_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  bank_name text not null check (char_length(trim(bank_name)) between 2 and 100),
  account_name text not null check (char_length(trim(account_name)) between 2 and 120),
  account_number text not null check (account_number ~ '^[0-9]{10}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table host_payout_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete restrict,
  bank_account_id uuid not null references host_bank_accounts(id) on delete restrict,
  amount_kobo bigint not null check (amount_kobo >= 100000),
  status text not null default 'requested'
    check (status in ('requested', 'paid', 'rejected')),
  scheduled_for date not null,
  bank_name text not null,
  account_name text not null,
  account_number text not null,
  reference text unique not null,
  transfer_reference text,
  admin_note text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references profiles(id) on delete set null
);

create index host_payout_requests_schedule_idx on host_payout_requests (status, scheduled_for, requested_at);
create index host_payout_requests_user_idx on host_payout_requests (user_id, requested_at desc);

alter table host_bank_accounts enable row level security;
alter table host_payout_requests enable row level security;

create policy host_bank_accounts_read_own_admin on host_bank_accounts
  for select using (auth.uid() = user_id or is_admin());
create policy host_payout_requests_read_own_admin on host_payout_requests
  for select using (auth.uid() = user_id or is_admin());

create or replace function set_host_bank_account(
  p_bank_name text,
  p_account_name text,
  p_account_number text
)
returns host_bank_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_account host_bank_accounts%rowtype;
  v_number text := regexp_replace(coalesce(p_account_number, ''), '\\s+', '', 'g');
begin
  if v_user is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if exists (select 1 from profiles where id = v_user and suspended) then raise exception 'account suspended' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_bank_name, ''))) < 2 or char_length(trim(coalesce(p_account_name, ''))) < 2 or v_number !~ '^[0-9]{10}$' then
    raise exception 'enter a valid Nigerian bank account' using errcode = 'P0001';
  end if;

  insert into host_bank_accounts (user_id, bank_name, account_name, account_number)
  values (v_user, trim(p_bank_name), trim(p_account_name), v_number)
  on conflict (user_id) do update
    set bank_name = excluded.bank_name,
        account_name = excluded.account_name,
        account_number = excluded.account_number,
        updated_at = now()
  returning * into v_account;
  return v_account;
end;
$$;

create or replace function request_host_payout(p_amount_kobo bigint)
returns host_payout_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_account host_bank_accounts%rowtype;
  v_balance bigint;
  v_earned bigint;
  v_reserved bigint;
  v_available bigint;
  v_reference text;
  v_local_date date := (now() at time zone 'Africa/Lagos')::date;
  v_scheduled_for date;
  v_request host_payout_requests%rowtype;
begin
  if v_user is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_amount_kobo is null or p_amount_kobo < 100000 then raise exception 'minimum host payout is NGN 1,000' using errcode = 'P0001'; end if;
  if exists (select 1 from profiles where id = v_user and suspended) then raise exception 'account suspended' using errcode = '42501'; end if;

  select * into v_account from host_bank_accounts where user_id = v_user for update;
  if not found then raise exception 'add a bank account before requesting payout' using errcode = 'P0001'; end if;

  insert into wallets (user_id, balance_kobo) values (v_user, 0) on conflict (user_id) do nothing;
  select balance_kobo into v_balance from wallets where user_id = v_user for update;

  select coalesce(sum(amount_kobo), 0) into v_earned
    from wallet_transactions
   where user_id = v_user
     and status = 'completed'
     and type in ('host_reimbursement', 'host_game_earnings');
  select coalesce(sum(case
    when type = 'host_withdrawal' then -amount_kobo
    when type = 'host_withdrawal_reversal' then -amount_kobo
    else 0
  end), 0) into v_reserved
    from wallet_transactions
   where user_id = v_user
     and status = 'completed'
     and type in ('host_withdrawal', 'host_withdrawal_reversal');
  v_available := least(v_balance, greatest(0, v_earned - v_reserved));
  if p_amount_kobo > v_available then raise exception 'amount exceeds withdrawable host earnings' using errcode = 'P0001'; end if;

  -- Friday requests are queued for the following Friday. Thursday 23:59 WAT
  -- remains the cutoff for the upcoming weekly payout batch.
  v_scheduled_for := v_local_date + ((5 - extract(dow from v_local_date)::int + 7) % 7);
  if extract(dow from v_local_date)::int = 5 then v_scheduled_for := v_scheduled_for + 7; end if;

  v_reference := 'HWD-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  update wallets set balance_kobo = balance_kobo - p_amount_kobo, updated_at = now() where user_id = v_user;
  insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference)
  values (v_user, 'host_withdrawal', 'completed', -p_amount_kobo, v_balance - p_amount_kobo, v_reference);

  insert into host_payout_requests (
    user_id, bank_account_id, amount_kobo, scheduled_for, bank_name, account_name, account_number, reference
  ) values (
    v_user, v_account.id, p_amount_kobo, v_scheduled_for, v_account.bank_name, v_account.account_name, v_account.account_number, v_reference
  ) returning * into v_request;
  return v_request;
end;
$$;

create or replace function admin_complete_host_payout(
  p_payout_id uuid,
  p_transfer_reference text default null,
  p_note text default null
)
returns host_payout_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_request host_payout_requests%rowtype;
begin
  if v_admin is null or not is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into v_request from host_payout_requests where id = p_payout_id for update;
  if not found then raise exception 'payout request not found' using errcode = 'P0002'; end if;
  if v_request.status <> 'requested' then raise exception 'payout request has already been reviewed' using errcode = 'P0001'; end if;
  if (now() at time zone 'Africa/Lagos')::date < v_request.scheduled_for then
    raise exception 'this payout is not due until %', v_request.scheduled_for using errcode = 'P0001';
  end if;
  if nullif(trim(coalesce(p_transfer_reference, '')), '') is null then raise exception 'enter the bank transfer reference' using errcode = 'P0001'; end if;

  update host_payout_requests
     set status = 'paid', transfer_reference = trim(p_transfer_reference), admin_note = nullif(trim(coalesce(p_note, '')), ''), reviewed_at = now(), reviewed_by = v_admin
   where id = v_request.id
   returning * into v_request;
  return v_request;
end;
$$;

create or replace function admin_reject_host_payout(p_payout_id uuid, p_note text)
returns host_payout_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_request host_payout_requests%rowtype;
  v_balance bigint;
  v_reference text;
begin
  if v_admin is null or not is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  if nullif(trim(coalesce(p_note, '')), '') is null then raise exception 'add a reason before rejecting payout' using errcode = 'P0001'; end if;
  select * into v_request from host_payout_requests where id = p_payout_id for update;
  if not found then raise exception 'payout request not found' using errcode = 'P0002'; end if;
  if v_request.status <> 'requested' then raise exception 'payout request has already been reviewed' using errcode = 'P0001'; end if;

  insert into wallets (user_id, balance_kobo) values (v_request.user_id, 0) on conflict (user_id) do nothing;
  update wallets set balance_kobo = balance_kobo + v_request.amount_kobo, updated_at = now()
   where user_id = v_request.user_id returning balance_kobo into v_balance;
  v_reference := 'HWR-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  insert into wallet_transactions (user_id, type, status, amount_kobo, balance_after_kobo, reference)
  values (v_request.user_id, 'host_withdrawal_reversal', 'completed', v_request.amount_kobo, v_balance, v_reference);

  update host_payout_requests
     set status = 'rejected', admin_note = trim(p_note), reviewed_at = now(), reviewed_by = v_admin
   where id = v_request.id
   returning * into v_request;
  return v_request;
end;
$$;

grant execute on function set_host_bank_account(text, text, text) to authenticated;
grant execute on function request_host_payout(bigint) to authenticated;
grant execute on function admin_complete_host_payout(uuid, text, text) to authenticated;
grant execute on function admin_reject_host_payout(uuid, text) to authenticated;
