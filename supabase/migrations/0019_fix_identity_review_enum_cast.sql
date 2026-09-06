-- ============================================================================
-- BUG FIX: admin_review_identity_verification() failed on every call with
-- "column \"status\" is of type kyc_status but expression is of type text".
--
-- The CASE expression's two string-literal branches ('approved'/'rejected')
-- have no way for Postgres to infer they should be kyc_status rather than
-- the default text/unknown — needs an explicit cast. Confirmed via a live
-- RLS/security verification pass against the real database: every other
-- part of the identity-verification flow (upload, submit, RLS isolation,
-- the non-admin-cannot-self-approve check, the column-lock on
-- profiles.identity_verified) passed; this was the one real defect.
-- ============================================================================

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
     set status      = (case when p_approve then 'approved' else 'rejected' end)::kyc_status,
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
