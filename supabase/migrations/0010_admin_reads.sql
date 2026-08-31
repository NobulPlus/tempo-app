-- ============================================================================
-- Nothing could read the waitlist table at all — 0001_init.sql only ever
-- granted an insert policy (`waitlist_insert ... with check (true)`), so not
-- even an admin could see the leads /partner and the homepage waitlist form
-- were quietly collecting. Adds the missing read policy, plus delete as the
-- "mark this lead as handled" mechanic — simpler than adding a status column
-- for a lightweight inbox.
-- ============================================================================

create policy waitlist_admin_read on waitlist for select using (is_admin());
create policy waitlist_admin_delete on waitlist for delete using (is_admin());
