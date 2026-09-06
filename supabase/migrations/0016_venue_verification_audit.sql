-- ============================================================================
-- Venue verification audit trail.
--
-- venues.verified/verified_at/verified_by/verification_note (0001_init.sql)
-- already capture who verified a venue and when — but every re-verify or
-- unverify overwrites those same columns, so there's no history of past
-- cycles, only the current state. This table is that history: one row per
-- verify/unverify action, never updated or overwritten.
-- ============================================================================

create table venue_verification_events (
  id         uuid primary key default uuid_generate_v4(),
  venue_id   uuid not null references venues(id) on delete cascade,
  admin_id   uuid not null references profiles(id),
  verified   boolean not null,
  note       text,
  created_at timestamptz not null default now()
);

create index venue_verification_events_venue_idx
  on venue_verification_events (venue_id, created_at desc);

alter table venue_verification_events enable row level security;

-- Admin-only both ways — this is an internal audit log, not a public or
-- venue-owner-facing feature. Writes only ever come from verifyVenue(),
-- which is already gated by requireAdmin() at the app layer.
create policy venue_verification_events_admin_read
  on venue_verification_events for select using (is_admin());
create policy venue_verification_events_admin_write
  on venue_verification_events for insert with check (is_admin());
