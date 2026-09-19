-- Real (persisted) email notification preference, and a public profile-photo
-- upload surface. Both are self-service, single-owner writes, so they reuse
-- the exact patterns already established: column-level grants for profile
-- fields (0002) and an own-folder storage bucket (0031/0033), this time with
-- size/mime limits set at creation instead of backfilled later (0044).

alter table profiles add column if not exists email_notifications_enabled boolean not null default true;

-- Additive: grants already on full_name/avatar_url/phone/area/side/position/
-- foot/bio (0002) are untouched. role/suspended/reputation columns stay
-- un-updatable by any direct client UPDATE.
grant update (email_notifications_enabled) on profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', true, 6291456, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy profile_photos_public_read on storage.objects
  for select using (bucket_id = 'profile-photos');

create policy profile_photos_insert_own on storage.objects
  for insert with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy profile_photos_update_own on storage.objects
  for update using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy profile_photos_delete_own on storage.objects
  for delete using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
