-- venue-photos bucket had no file_size_limit/allowed_mime_types, so a client
-- calling the Storage API directly with a valid session (bypassing the
-- Next.js server action's validateVenuePhoto check) could upload arbitrarily
-- large or non-image files into their own folder. Mirrors the app-layer
-- limits (6MB, image/*) at the storage level so both layers agree.
update storage.buckets
set file_size_limit = 6291456,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'venue-photos';
