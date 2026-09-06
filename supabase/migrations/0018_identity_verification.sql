-- ============================================================================
-- Identity verification (KYC) scaffolding: document upload + admin manual
-- review. No phone/SMS OTP in this pass — no SMS provider is wired up.
--
-- Same privacy split this codebase already applies twice (phone -> 0009,
-- wallet balance -> 0011): the verification STATUS is safe to be public —
-- it's a trust badge, exactly like venues.verified — but the DOCUMENT must
-- never be. Two different exposure levels get two different homes:
--   - profiles.identity_verified: public boolean, same profiles_read
--     (using (true)) policy already covers it — this is new information,
--     not a new leak.
--   - identity_verifications + the private Storage bucket: strictly
--     owner + admin, never public, matching payments_read's "strictly your
--     own, no public read, ever" posture.
-- ============================================================================

create type kyc_status as enum ('pending', 'approved', 'rejected');

-- ---------------------------------------------------- public status column
alter table profiles add column if not exists identity_verified boolean not null default false;

-- Column-level grant on profiles is an ENUMERATED allow-list, not a
-- blacklist (see 0002_auth_hardening.sql's `grant update (full_name, ...)`).
-- identity_verified is simply never added to that list, so it's already
-- un-updatable by any direct client UPDATE, from any authenticated user,
-- with no further revoke needed — only admin_review_identity_verification()
-- below can change it.

-- ---------------------------------------------------------- submissions
create table identity_verifications (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references profiles(id) on delete cascade,
  document_path text not null,
  status        kyc_status not null default 'pending',
  reviewed_by   uuid references profiles(id),
  reviewed_at   timestamptz,
  review_note   text,
  created_at    timestamptz not null default now()
);

create index identity_verifications_user_idx on identity_verifications (user_id, created_at desc);

alter table identity_verifications enable row level security;

-- Submitter can see and create their own rows; no self-update (can't edit
-- after submitting — a new submission is a new row). Admin read-all.
create policy identity_verifications_read_own on identity_verifications
  for select using (auth.uid() = user_id);
create policy identity_verifications_insert_own on identity_verifications
  for insert with check (auth.uid() = user_id);
create policy identity_verifications_admin_read on identity_verifications
  for select using (is_admin());

-- ---------------------------------------------------------- review RPC
-- security definer so it can update profiles.identity_verified (which no
-- direct client UPDATE can touch) in the same transaction as the review
-- decision. Checks is_admin() itself, same convention as admin_set_role/
-- admin_set_suspended — the internal check is the real gate, the grant to
-- `authenticated` below is not a security boundary by itself.
create or replace function admin_review_identity_verification(
  p_verification_id uuid,
  p_approve         boolean,
  p_note            text
)
returns identity_verifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row identity_verifications%rowtype;
begin
  if not is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update identity_verifications
     set status      = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_note = p_note
   where id = p_verification_id
   returning * into v_row;

  if not found then
    raise exception 'verification not found' using errcode = 'P0002';
  end if;

  update profiles set identity_verified = p_approve where id = v_row.user_id;

  return v_row;
end;
$$;

grant execute on function admin_review_identity_verification(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------- storage bucket
-- Private bucket — first upload surface in this app, so there's no existing
-- pattern to reuse beyond keeping the same shape as the row-ownership model
-- above: own-path read/write, admin read-all. Object paths are expected to
-- be `{auth.uid()}/{filename}`.
insert into storage.buckets (id, name, public)
values ('identity-documents', 'identity-documents', false)
on conflict (id) do nothing;

create policy identity_documents_insert_own on storage.objects
  for insert with check (
    bucket_id = 'identity-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy identity_documents_read_own on storage.objects
  for select using (
    bucket_id = 'identity-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy identity_documents_admin_read on storage.objects
  for select using (
    bucket_id = 'identity-documents' and is_admin()
  );
