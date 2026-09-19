-- 0046's admin_review_message_report() assigned a `case when ... then
-- 'reviewed' else 'dismissed' end` expression to message_reports.status.
-- Unlike a bare literal (which gets an implicit unknown-type cast to the
-- target enum), a CASE expression's branches are resolved to a common type
-- (text) before assignment, so Postgres rejected it: "column status is of
-- type message_report_status but expression is of type text" — caught by
-- live verification before this ever reached app code. Fix: cast the whole
-- expression to the enum explicitly.
create or replace function admin_review_message_report(p_report_id uuid, p_action text, p_note text)
returns message_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row message_reports%rowtype;
begin
  if not is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_action not in ('dismiss', 'suspend_user') then
    raise exception 'unknown action' using errcode = 'P0001';
  end if;

  update message_reports
     set status      = (case when p_action = 'suspend_user' then 'reviewed' else 'dismissed' end)::message_report_status,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_note = p_note
   where id = p_report_id
   returning * into v_row;

  if not found then
    raise exception 'report not found' using errcode = 'P0002';
  end if;

  if p_action = 'suspend_user' then
    perform admin_set_suspended(v_row.reported_user_id, true);
  end if;

  return v_row;
end;
$$;
