-- Closes a real gap: there is no way for a signed-in player to view or edit
-- their own profile beyond the photo (/account, built earlier). full_name/
-- area/position/foot/bio have been self-editable via column grant since
-- 0002, but nothing in the UI ever used it. phone is worse: 0009 moved it
-- into profiles_private with a read-own policy but never added a write
-- path at all — a phone could only ever be set once, at signup, via
-- metadata, with zero way to add or change it afterward.

create policy profiles_private_upsert_own on profiles_private for insert
  with check (auth.uid() = id);
create policy profiles_private_update_own on profiles_private for update
  using (auth.uid() = id) with check (auth.uid() = id);
