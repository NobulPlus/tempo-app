-- ============================================================================
-- `slots.during` and `games.during` are tstzrange columns — correct for the
-- GiST exclusion constraint that makes double-booking impossible, but every
-- other layer of this app (lib/types.ts, lib/match.ts, every UI component)
-- expects separate startsAt/endsAt fields. Rather than parse Postgres range
-- literal strings in JS everywhere a slot or game is read, expose the
-- boundaries as real, generated, filterable columns once, here. lower()/
-- upper() on a tstzrange are immutable (timestamptz is already UTC-absolute),
-- so this qualifies as a STORED generated column — a normal column as far
-- as PostgREST and RLS are concerned, no view/security_invoker complexity.
-- ============================================================================

alter table slots add column starts_at timestamptz generated always as (lower(during)) stored;
alter table slots add column ends_at   timestamptz generated always as (upper(during)) stored;

alter table games add column starts_at timestamptz generated always as (lower(during)) stored;
alter table games add column ends_at   timestamptz generated always as (upper(during)) stored;

create index if not exists slots_starts_at_idx on slots (starts_at);
create index if not exists games_starts_at_idx on games (starts_at);
