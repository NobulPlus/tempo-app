-- ============================================================================
-- Fix handle_new_user(): the original formula concatenated the FULL cleaned
-- local-part of the email with a 4-char suffix, with no length cap. Any
-- email whose local-part cleans up to 21+ characters violates profiles'
-- own `handle ~ '^[a-z0-9_]{3,24}$'` check constraint, which fails the
-- trigger and rolls back the entire signup with an opaque "Database error
-- saving new user" — discovered by testing a real signup against this
-- project, not a hypothetical.
-- ============================================================================

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

  insert into profiles (id, handle, full_name, phone, role)
  values (
    new.id,
    substr(base, 1, 20) || substr(md5(new.id::text), 1, 4),
    coalesce(new.raw_user_meta_data->>'full_name', 'New Player'),
    new.raw_user_meta_data->>'phone',
    'player'
  );
  return new;
end;
$$;
