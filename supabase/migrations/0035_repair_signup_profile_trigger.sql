-- Keep auth signup resilient after profile phone data was moved out of
-- public.profiles. If the live database still has an older trigger body, a
-- new signup can fail with Supabase's opaque "Database error saving new user".

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_]', '', 'g'));
  normalized_phone text := nullif(new.raw_user_meta_data->>'phone', '');
begin
  if base = '' then
    base := 'player';
  end if;

  insert into profiles (id, handle, full_name, role)
  values (
    new.id,
    substr(base, 1, 20) || substr(md5(new.id::text), 1, 4),
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), 'New Player'),
    'player'
  );

  if normalized_phone is not null
     and to_regclass('public.profiles_private') is not null
  then
    insert into profiles_private (id, phone)
    values (new.id, normalized_phone)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
