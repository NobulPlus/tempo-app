-- Venue media and future activity expansion.
-- Venues remain the marketplace supply object; pitches/courts/rooms can later
-- specialize by activity without forcing the venue itself to be football-only.

alter table venues
  add column if not exists activity_type text not null default 'football';

alter table venues
  add column if not exists supported_activities text[] not null default array['football']::text[];

alter table venues
  add constraint venues_activity_type_not_blank
  check (length(trim(activity_type)) > 0)
  not valid;

alter table venues validate constraint venues_activity_type_not_blank;

alter table venues
  add constraint venues_supported_activities_not_empty
  check (array_length(supported_activities, 1) >= 1)
  not valid;

alter table venues validate constraint venues_supported_activities_not_empty;

insert into storage.buckets (id, name, public)
values ('venue-photos', 'venue-photos', true)
on conflict (id) do nothing;

create policy venue_photos_public_read on storage.objects
  for select using (bucket_id = 'venue-photos');

create policy venue_photos_insert_own on storage.objects
  for insert with check (
    bucket_id = 'venue-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy venue_photos_update_own on storage.objects
  for update using (
    bucket_id = 'venue-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'venue-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy venue_photos_delete_own on storage.objects
  for delete using (
    bucket_id = 'venue-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
