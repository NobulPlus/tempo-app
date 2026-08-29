-- ============================================================================
-- URGENT FIX: 0008_profile_column_privacy.sql broke every select("*") /
-- embedded profiles(*) call in the app (getCurrentUser() in
-- src/lib/session.ts, and every host:/player: embed in GAME_SELECT in
-- src/lib/data/repo.ts — i.e. games listings, game detail pages, rosters).
--
-- Confirmed directly against this database: PostgREST's `select=*` requires
-- privilege on EVERY column of the relation, not just the ones you're
-- interested in. Once phone lost its grant, `select("*")` didn't narrow
-- to the accessible columns (as plain psql SELECT * can) — it hard-failed
-- with "permission denied for table profiles" for anyone (including a user
-- reading their own row). That meant nobody could be recognised as signed
-- in anymore.
--
-- Real fix: don't try to hide one column of an otherwise-`using (true)`
-- public table via column grants. Move phone to its own table with no
-- public read policy at all. Every other column-privacy problem this kind
-- of table might have in the future should use this pattern, not
-- column-level GRANT/REVOKE — that technique only works for UPDATE (as
-- 0002_auth_hardening.sql uses it), not SELECT with `*`/embeds in play.
-- ============================================================================

-- Undo 0008's broken grant — restore full SELECT so select("*") and every
-- profiles(*) embed work again immediately.
grant select on profiles to authenticated, anon;

create table profiles_private (
  id    uuid primary key references profiles(id) on delete cascade,
  phone text unique
);

insert into profiles_private (id, phone)
select id, phone from profiles where phone is not null
on conflict (id) do nothing;

alter table profiles drop column phone;

alter table profiles_private enable row level security;

-- Strictly your own — no public/host/admin read policy. Nobody needed this
-- beyond the owner (confirmed: no client code reads a profile's own phone
-- back today), so there's nothing to widen later without a real need.
create policy profiles_private_read on profiles_private for select
  using (auth.uid() = id);

-- handle_new_user() (0001, then 0002, then 0003) inserted phone straight
-- into profiles. That column is gone; write to profiles_private instead.
-- Body otherwise matches 0003_fix_handle_generation.sql exactly.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_]', '', 'g'));
begin
  if base = '' then
    base := 'player';
  end if;

  insert into profiles (id, handle, full_name, role)
  values (
    new.id,
    substr(base, 1, 20) || substr(md5(new.id::text), 1, 4),
    coalesce(new.raw_user_meta_data->>'full_name', 'New Player'),
    'player'
  );

  if new.raw_user_meta_data->>'phone' is not null then
    insert into profiles_private (id, phone)
    values (new.id, new.raw_user_meta_data->>'phone')
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;
