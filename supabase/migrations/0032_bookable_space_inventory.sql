-- Richer venue inventory. The table stays named `pitches` for application
-- compatibility, but each row can now describe any bookable sport/activity
-- resource: pitch, court, studio, field, gym space, track, or other.

alter table pitches
  add column if not exists resource_type text not null default 'pitch',
  add column if not exists activity_type text not null default 'football',
  add column if not exists supported_activities text[] not null default array['football']::text[],
  add column if not exists photos text[] not null default '{}',
  add column if not exists amenities text[] not null default '{}',
  add column if not exists capacity int,
  add column if not exists recommended_players int,
  add column if not exists description text not null default '';

alter table pitches
  add constraint pitches_resource_type_not_blank
  check (length(trim(resource_type)) > 0)
  not valid;

alter table pitches validate constraint pitches_resource_type_not_blank;

alter table pitches
  add constraint pitches_activity_type_not_blank
  check (length(trim(activity_type)) > 0)
  not valid;

alter table pitches validate constraint pitches_activity_type_not_blank;

alter table pitches
  add constraint pitches_supported_activities_not_empty
  check (array_length(supported_activities, 1) >= 1)
  not valid;

alter table pitches validate constraint pitches_supported_activities_not_empty;

alter table pitches
  add constraint pitches_capacity_positive
  check (capacity is null or capacity > 0)
  not valid;

alter table pitches validate constraint pitches_capacity_positive;

alter table pitches
  add constraint pitches_recommended_players_positive
  check (recommended_players is null or recommended_players > 0)
  not valid;

alter table pitches validate constraint pitches_recommended_players_positive;
