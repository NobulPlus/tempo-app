-- ============================================================================
-- TEMPO — auth hardening + admin foundation
--
-- Closes two privilege-escalation gaps that existed in 0001 independent of
-- anything new: (1) handle_new_user() trusted a client-supplied `role` in
-- signup metadata, so a signup could request role: 'admin' directly; (2)
-- profiles_update RLS checked row ownership only, with no column
-- restriction, so a signed-in user could UPDATE their own row's `role`.
--
-- Fix for (1): stop reading role from metadata at all — every new profile
-- is 'player', full stop. Fix for (2): column-level GRANTs, not RLS —
-- RLS's USING/WITH CHECK can't restrict which columns an UPDATE touches,
-- only which rows. Privileged role/suspension changes go through
-- SECURITY DEFINER functions instead, gated by is_admin(), so a normal
-- UPDATE can never touch those columns regardless of caller.
-- ============================================================================

-- ---------------------------------------------------- role is never client-set
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, handle, full_name, phone, role)
  values (
    new.id,
    lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_]', '', 'g'))
      || substr(md5(new.id::text), 1, 4),
    coalesce(new.raw_user_meta_data->>'full_name', 'New Player'),
    new.raw_user_meta_data->>'phone',
    'player' -- always. Elevated roles are granted by an admin, never self-declared.
  );
  return new;
end;
$$;

-- ---------------------------------------------------- moderation column
alter table profiles add column if not exists suspended boolean not null default false;

-- ---------------------------------------------------- lock down profiles UPDATE
-- Supabase grants broad table privileges to `authenticated` by default and
-- relies on RLS alone; that's not enough here, since RLS can't be column-aware.
revoke update on profiles from authenticated, anon;
grant update (full_name, avatar_url, phone, area, side, position, foot, bio)
  on profiles to authenticated;
-- role, suspended, and every reputation column are now un-updatable by any
-- direct UPDATE, from any authenticated user, regardless of RLS. The only
-- ways they change: the triggers already in 0001 (reputation), and the
-- admin_set_* functions below (role, suspended).

-- ---------------------------------------------------- admin check + privileged RPCs
create or replace function is_admin()
returns boolean
language sql
stable
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function admin_set_role(target_id uuid, new_role user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;
  update profiles set role = new_role where id = target_id;
end;
$$;

create or replace function admin_set_suspended(target_id uuid, val boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;
  update profiles set suspended = val where id = target_id;
end;
$$;

grant execute on function admin_set_role(uuid, user_role) to authenticated;
grant execute on function admin_set_suspended(uuid, boolean) to authenticated;

-- ---------------------------------------------------- admin RLS overrides
-- These tables have no column-privilege concern (nothing here revoked their
-- base UPDATE grant), so a normal admin-gated policy is sufficient.
create policy venues_admin_all on venues for all
  using (is_admin()) with check (is_admin());

create policy bookings_admin_all on bookings for all
  using (is_admin()) with check (is_admin());

create policy payments_admin_all on payments for all
  using (is_admin()) with check (is_admin());
