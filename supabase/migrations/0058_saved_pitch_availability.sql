-- Saved operating rules let an owner generate availability once and have the
-- operations cron safely extend the bookable horizon thereafter.

create table if not exists pitch_availability_schedules (
  pitch_id uuid primary key references pitches(id) on delete cascade,
  rules jsonb not null check (jsonb_typeof(rules) = 'array' and jsonb_array_length(rules) > 0),
  slot_duration_minutes int not null check (slot_duration_minutes between 30 and 240),
  buffer_minutes int not null check (buffer_minutes between 0 and 120),
  days_ahead int not null check (days_ahead between 1 and 60),
  enabled boolean not null default true,
  last_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pitch_availability_schedules_enabled_idx
  on pitch_availability_schedules (enabled, last_generated_at);

create or replace function touch_pitch_availability_schedule()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

alter table pitch_availability_schedules enable row level security;

drop policy if exists pitch_availability_schedules_read_own on pitch_availability_schedules;
create policy pitch_availability_schedules_read_own on pitch_availability_schedules
  for select using (
    exists (
      select 1 from pitches p join venues v on v.id = p.venue_id
       where p.id = pitch_availability_schedules.pitch_id
         and v.owner_id = auth.uid()
    )
  );

drop policy if exists pitch_availability_schedules_write_own on pitch_availability_schedules;
create policy pitch_availability_schedules_write_own on pitch_availability_schedules
  for all using (
    exists (
      select 1 from pitches p join venues v on v.id = p.venue_id
       where p.id = pitch_availability_schedules.pitch_id
         and v.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from pitches p join venues v on v.id = p.venue_id
       where p.id = pitch_availability_schedules.pitch_id
         and v.owner_id = auth.uid()
    )
  );

drop trigger if exists pitch_availability_schedules_touch on pitch_availability_schedules;
create trigger pitch_availability_schedules_touch
before update on pitch_availability_schedules
for each row execute function touch_pitch_availability_schedule();
