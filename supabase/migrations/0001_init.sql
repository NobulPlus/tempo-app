-- ============================================================================
-- TEMPO — initial schema
-- Postgres 15 / Supabase
--
-- Design notes:
--  * Money is BIGINT kobo. Never numeric, never float.
--  * Double-booking is prevented by a GiST exclusion constraint, not by
--    application code. Application-level checks lose the race under load.
--  * Reputation (punctuality, traits, streaks) is DERIVED from events, never
--    self-declared. See the triggers at the bottom.
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists btree_gist;   -- needed to mix uuid = with tstzrange &&

-- ---------------------------------------------------------------- enums ----
create type user_role       as enum ('player', 'host', 'venue_owner', 'admin');
create type pitch_size      as enum ('5-a-side', '7-a-side', '11-a-side');
create type pitch_surface   as enum ('astro', 'grass', 'indoor', 'concrete');
create type skill_level     as enum ('casual', 'intermediate', 'competitive');
create type player_position as enum ('GK', 'DEF', 'MID', 'FWD');
create type player_foot     as enum ('left', 'right', 'both');
create type slot_status     as enum ('open', 'held', 'booked', 'blocked');
create type booking_status  as enum ('pending', 'confirmed', 'cancelled', 'completed', 'refunded');
create type game_status     as enum ('open', 'locked', 'cancelled', 'played');
create type participant_status as enum ('confirmed', 'waitlist', 'withdrawn', 'no_show', 'played');
create type payment_method  as enum ('card', 'transfer', 'ussd');
create type payment_status  as enum ('initialised', 'succeeded', 'failed', 'refunded');

-- ---------------------------------------------------------------- profiles --
-- Mirrors auth.users. Supabase owns credentials; we own everything else.
create table profiles (
  id                  uuid primary key references auth.users on delete cascade,
  handle              text unique not null check (handle ~ '^[a-z0-9_]{3,24}$'),
  full_name           text not null,
  avatar_url          text,
  phone               text unique,
  area                text,
  side                text check (side in ('island', 'mainland')),
  position            player_position,
  foot                player_foot,
  bio                 text check (char_length(bio) <= 280),
  role                user_role not null default 'player',

  -- Reputation. All maintained by triggers/jobs — never written by clients.
  games_played        int  not null default 0,
  punctuality_score   int  not null default 100 check (punctuality_score between 0 and 100),
  streak_weeks        int  not null default 0,
  longest_streak_weeks int not null default 0,
  motm_count          int  not null default 0,
  peer_rating         numeric(3,2),
  peer_rating_count   int  not null default 0,
  trait_pace          int  not null default 50 check (trait_pace between 0 and 100),
  trait_passing       int  not null default 50,
  trait_finishing     int  not null default 50,
  trait_defending     int  not null default 50,
  trait_stamina       int  not null default 50,
  trait_teamwork      int  not null default 50,

  last_played_at      timestamptz,
  created_at          timestamptz not null default now()
);

create index profiles_area_idx on profiles (area);

-- ------------------------------------------------------------------ venues --
create table venues (
  id            uuid primary key default uuid_generate_v4(),
  slug          text unique not null,
  name          text not null,
  area          text not null,
  side          text not null check (side in ('island', 'mainland')),
  address       text not null,
  lat           double precision not null,
  lng           double precision not null,
  phone         text,
  description   text not null default '',
  amenities     text[] not null default '{}',
  photos        text[] not null default '{}',
  owner_id      uuid references profiles(id) on delete set null,

  -- Verification is a claim we make publicly, so it needs an audit trail.
  verified      boolean not null default false,
  verified_at   timestamptz,
  verified_by   uuid references profiles(id),
  verification_note text,

  created_at    timestamptz not null default now(),
  constraint verified_needs_timestamp
    check (verified = false or verified_at is not null)
);

create index venues_area_idx on venues (area);
create index venues_geo_idx  on venues (lat, lng);

-- ------------------------------------------------------------------ pitches --
create table pitches (
  id                 uuid primary key default uuid_generate_v4(),
  venue_id           uuid not null references venues(id) on delete cascade,
  slug               text unique not null,
  name               text not null,
  size               pitch_size not null,
  surface            pitch_surface not null,
  floodlights        boolean not null default true,
  covered            boolean not null default false,
  price_per_hour_kobo bigint not null check (price_per_hour_kobo > 0),
  peak_multiplier    numeric(3,2) not null default 1.00 check (peak_multiplier >= 1),
  rating             numeric(2,1),
  review_count       int not null default 0,
  active             boolean not null default true,
  created_at         timestamptz not null default now()
);

create index pitches_venue_idx on pitches (venue_id);

-- -------------------------------------------------------------------- slots --
-- One row per bookable hour. Generated ahead by a scheduled job.
create table slots (
  id         uuid primary key default uuid_generate_v4(),
  pitch_id   uuid not null references pitches(id) on delete cascade,
  during     tstzrange not null,
  price_kobo bigint not null check (price_kobo > 0),
  status     slot_status not null default 'open',
  held_until timestamptz,
  created_at timestamptz not null default now(),

  constraint slot_duration_sane
    check (upper(during) > lower(during))
);

-- THE constraint that makes double-booking impossible.
-- Two slots on the same pitch may not have overlapping time ranges unless
-- one of them is blocked/cancelled.
alter table slots
  add constraint slots_no_overlap
  exclude using gist (
    pitch_id with =,
    during   with &&
  ) where (status <> 'blocked');

create index slots_pitch_time_idx on slots using gist (pitch_id, during);
create index slots_open_idx on slots (status, lower(during)) where status = 'open';

-- ----------------------------------------------------------------- bookings --
create table bookings (
  id             uuid primary key default uuid_generate_v4(),
  reference      text unique not null,
  slot_id        uuid not null unique references slots(id) on delete restrict,
  user_id        uuid not null references profiles(id) on delete restrict,
  status         booking_status not null default 'pending',
  total_kobo     bigint not null check (total_kobo >= 0),
  paid_kobo      bigint not null default 0,
  payment_method payment_method,
  notes          text,
  cancelled_at   timestamptz,
  cancel_reason  text,
  created_at     timestamptz not null default now()
);

create index bookings_user_idx on bookings (user_id, created_at desc);

-- -------------------------------------------------------------------- games --
create table games (
  id                    uuid primary key default uuid_generate_v4(),
  slug                  text unique not null,
  pitch_id              uuid not null references pitches(id) on delete restrict,
  host_id               uuid not null references profiles(id) on delete restrict,
  booking_id            uuid references bookings(id) on delete set null,
  title                 text not null,
  description           text not null default '',
  level                 skill_level not null default 'casual',
  during                tstzrange not null,
  capacity              int not null check (capacity between 2 and 30),
  minimum_to_guarantee  int not null check (minimum_to_guarantee >= 2),
  price_per_player_kobo bigint not null check (price_per_player_kobo >= 0),
  status                game_status not null default 'open',
  bibs_provided         boolean not null default false,
  recurring_rule        text,           -- iCal RRULE, e.g. FREQ=WEEKLY;BYDAY=TU
  parent_game_id        uuid references games(id) on delete set null,
  created_at            timestamptz not null default now(),

  constraint guarantee_within_capacity check (minimum_to_guarantee <= capacity)
);

create index games_time_idx   on games using gist (during);
create index games_status_idx on games (status, lower(during));

-- ------------------------------------------------------------ participants --
create table game_participants (
  id          uuid primary key default uuid_generate_v4(),
  game_id     uuid not null references games(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  status      participant_status not null default 'confirmed',
  paid_kobo   bigint not null default 0,
  joined_at   timestamptz not null default now(),
  checked_in_at timestamptz,
  minutes_late  int,

  unique (game_id, user_id)      -- you cannot join the same game twice
);

create index participants_game_idx on game_participants (game_id);
create index participants_user_idx on game_participants (user_id);

-- ----------------------------------------------------------------- payments --
create table payments (
  id             uuid primary key default uuid_generate_v4(),
  reference      text unique not null,
  user_id        uuid not null references profiles(id) on delete restrict,
  booking_id     uuid references bookings(id) on delete set null,
  participant_id uuid references game_participants(id) on delete set null,
  amount_kobo    bigint not null check (amount_kobo > 0),
  method         payment_method,
  status         payment_status not null default 'initialised',
  provider       text not null default 'paystack',
  provider_ref   text,
  raw_response   jsonb,
  created_at     timestamptz not null default now(),
  settled_at     timestamptz,

  constraint payment_targets_something
    check (booking_id is not null or participant_id is not null)
);

-- ------------------------------------------------------------------ ratings --
create table ratings (
  id         uuid primary key default uuid_generate_v4(),
  game_id    uuid not null references games(id) on delete cascade,
  rater_id   uuid not null references profiles(id) on delete cascade,
  ratee_id   uuid not null references profiles(id) on delete cascade,
  score      int not null check (score between 1 and 5),
  motm       boolean not null default false,
  trait_vote text check (trait_vote in ('pace','passing','finishing','defending','stamina','teamwork')),
  created_at timestamptz not null default now(),

  unique (game_id, rater_id, ratee_id),
  constraint no_self_rating check (rater_id <> ratee_id)
);

-- ------------------------------------------------------------ venue reviews --
create table venue_reviews (
  id         uuid primary key default uuid_generate_v4(),
  pitch_id   uuid not null references pitches(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  booking_id uuid references bookings(id) on delete set null,
  score      int not null check (score between 1 and 5),
  body       text,
  created_at timestamptz not null default now(),
  unique (pitch_id, user_id, booking_id)
);

-- ------------------------------------------------------------------ waitlist --
create table waitlist (
  id         uuid primary key default uuid_generate_v4(),
  email      text,
  phone      text,
  area       text,
  role       user_role not null default 'player',
  created_at timestamptz not null default now(),
  constraint waitlist_has_contact check (email is not null or phone is not null)
);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Atomically join a game. Returns the participant row.
-- Handles capacity, waitlisting and duplicate joins inside one transaction so
-- two people tapping "Join" simultaneously can never both take the last spot.
create or replace function join_game(p_game_id uuid)
returns game_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_game   games%rowtype;
  v_count  int;
  v_status participant_status;
  v_row    game_participants%rowtype;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Lock the game row so concurrent joins serialise here.
  select * into v_game from games where id = p_game_id for update;

  if not found then
    raise exception 'game not found' using errcode = 'P0002';
  end if;
  if v_game.status <> 'open' then
    raise exception 'game is not open' using errcode = 'P0001';
  end if;
  if lower(v_game.during) <= now() then
    raise exception 'game has already started' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from game_participants
  where game_id = p_game_id and status = 'confirmed';

  v_status := case when v_count >= v_game.capacity then 'waitlist' else 'confirmed' end;

  insert into game_participants (game_id, user_id, status)
  values (p_game_id, v_user, v_status)
  on conflict (game_id, user_id) do update
    set status = case
                   when game_participants.status = 'withdrawn' then excluded.status
                   else game_participants.status
                 end
  returning * into v_row;

  -- Auto-lock once full
  if v_status = 'confirmed' and v_count + 1 >= v_game.capacity then
    update games set status = 'locked' where id = p_game_id;
  end if;

  return v_row;
end;
$$;

-- Leave a game and promote the first person off the waitlist.
create or replace function leave_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_next uuid;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  update game_participants
     set status = 'withdrawn'
   where game_id = p_game_id and user_id = v_user;

  select id into v_next
    from game_participants
   where game_id = p_game_id and status = 'waitlist'
   order by joined_at
   limit 1;

  if v_next is not null then
    update game_participants set status = 'confirmed' where id = v_next;
  else
    update games set status = 'open' where id = p_game_id and status = 'locked';
  end if;
end;
$$;

-- Recompute a player's reputation from their event history.
-- Called after ratings land and after attendance is marked.
create or replace function recompute_reputation(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_played int;
  v_no_show int;
  v_late_total int;
  v_avg numeric;
  v_cnt int;
  v_motm int;
begin
  select
    count(*) filter (where status = 'played'),
    count(*) filter (where status = 'no_show'),
    coalesce(sum(greatest(minutes_late, 0)) filter (where status = 'played'), 0)
  into v_played, v_no_show, v_late_total
  from game_participants where user_id = p_user;

  select avg(score), count(*), count(*) filter (where motm)
  into v_avg, v_cnt, v_motm
  from ratings where ratee_id = p_user;

  update profiles set
    games_played = v_played,
    motm_count   = coalesce(v_motm, 0),
    peer_rating  = round(v_avg, 2),
    peer_rating_count = coalesce(v_cnt, 0),
    -- 100 baseline, −12 per no-show, −1 per 5 minutes late, floored at 0
    punctuality_score = greatest(
      0,
      least(100, 100 - (v_no_show * 12) - (v_late_total / 5))
    )
  where id = p_user;
end;
$$;

-- Trait votes nudge the relevant trait upward, decaying as it approaches 100.
create or replace function apply_trait_vote()
returns trigger
language plpgsql
as $$
begin
  if new.trait_vote is null then return new; end if;

  execute format(
    'update profiles set trait_%I = least(100, trait_%I + greatest(1, (100 - trait_%I) / 12)) where id = $1',
    new.trait_vote, new.trait_vote, new.trait_vote
  ) using new.ratee_id;

  perform recompute_reputation(new.ratee_id);
  return new;
end;
$$;

create trigger ratings_apply_trait
  after insert on ratings
  for each row execute function apply_trait_vote();

-- Keep the streak honest: consecutive ISO weeks with at least one game played.
create or replace function bump_streak()
returns trigger
language plpgsql
as $$
declare
  v_last timestamptz;
  v_streak int;
begin
  if new.status <> 'played' then return new; end if;

  select last_played_at, streak_weeks into v_last, v_streak
  from profiles where id = new.user_id;

  if v_last is null then
    v_streak := 1;
  elsif date_trunc('week', now()) = date_trunc('week', v_last) then
    -- already counted this week
    return new;
  elsif date_trunc('week', now()) - date_trunc('week', v_last) = interval '1 week' then
    v_streak := v_streak + 1;
  else
    v_streak := 1;                        -- streak broken
  end if;

  update profiles set
    streak_weeks = v_streak,
    longest_streak_weeks = greatest(longest_streak_weeks, v_streak),
    last_played_at = now()
  where id = new.user_id;

  return new;
end;
$$;

create trigger participants_bump_streak
  after update of status on game_participants
  for each row execute function bump_streak();

-- Keep pitch rating in sync with its reviews.
create or replace function refresh_pitch_rating()
returns trigger
language plpgsql
as $$
begin
  update pitches p set
    rating = sub.avg_score,
    review_count = sub.n
  from (
    select pitch_id, round(avg(score)::numeric, 1) as avg_score, count(*) as n
    from venue_reviews where pitch_id = coalesce(new.pitch_id, old.pitch_id)
    group by pitch_id
  ) sub
  where p.id = sub.pitch_id;
  return null;
end;
$$;

create trigger venue_reviews_refresh
  after insert or update or delete on venue_reviews
  for each row execute function refresh_pitch_rating();

-- Create a profile automatically when someone signs up.
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
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'player')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================================
-- ROW LEVEL SECURITY
-- Default deny. Every table locked, then opened deliberately.
-- ============================================================================

alter table profiles          enable row level security;
alter table venues            enable row level security;
alter table pitches           enable row level security;
alter table slots             enable row level security;
alter table bookings          enable row level security;
alter table games             enable row level security;
alter table game_participants enable row level security;
alter table payments          enable row level security;
alter table ratings           enable row level security;
alter table venue_reviews     enable row level security;
alter table waitlist          enable row level security;

-- Profiles: public read (player cards are public), self write.
create policy profiles_read   on profiles for select using (true);
create policy profiles_update on profiles for update using (auth.uid() = id);

-- Venues & pitches: public read; owners manage their own.
create policy venues_read  on venues  for select using (true);
create policy venues_write on venues  for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy pitches_read  on pitches for select using (true);
create policy pitches_write on pitches for all
  using (exists (select 1 from venues v where v.id = venue_id and v.owner_id = auth.uid()))
  with check (exists (select 1 from venues v where v.id = venue_id and v.owner_id = auth.uid()));

-- Slots: public read (availability is public); venue owners manage.
create policy slots_read  on slots for select using (true);
create policy slots_write on slots for all
  using (exists (
    select 1 from pitches p join venues v on v.id = p.venue_id
    where p.id = pitch_id and v.owner_id = auth.uid()))
  with check (exists (
    select 1 from pitches p join venues v on v.id = p.venue_id
    where p.id = pitch_id and v.owner_id = auth.uid()));

-- Bookings: you see your own; venue owners see bookings on their pitches.
create policy bookings_read_own on bookings for select
  using (auth.uid() = user_id);
create policy bookings_read_venue on bookings for select
  using (exists (
    select 1 from slots s
      join pitches p on p.id = s.pitch_id
      join venues v  on v.id = p.venue_id
    where s.id = slot_id and v.owner_id = auth.uid()));
create policy bookings_insert on bookings for insert
  with check (auth.uid() = user_id);
create policy bookings_update_own on bookings for update
  using (auth.uid() = user_id);

-- Games: public read; host writes.
create policy games_read   on games for select using (true);
create policy games_insert on games for insert with check (auth.uid() = host_id);
create policy games_update on games for update using (auth.uid() = host_id);

-- Participants: public read (the roster is the point); self-insert only.
create policy participants_read   on game_participants for select using (true);
create policy participants_insert on game_participants for insert
  with check (auth.uid() = user_id);
create policy participants_update on game_participants for update
  using (auth.uid() = user_id
         or exists (select 1 from games g where g.id = game_id and g.host_id = auth.uid()));

-- Payments: strictly your own. No public read, ever.
create policy payments_read on payments for select using (auth.uid() = user_id);

-- Ratings: readable by participants of that game; you may only rate as yourself,
-- only someone who was in the same game, and only after it finished.
create policy ratings_read on ratings for select
  using (exists (
    select 1 from game_participants gp
    where gp.game_id = ratings.game_id and gp.user_id = auth.uid()));
create policy ratings_insert on ratings for insert
  with check (
    auth.uid() = rater_id
    and exists (
      select 1 from game_participants gp
      where gp.game_id = ratings.game_id and gp.user_id = auth.uid()
        and gp.status = 'played')
    and exists (
      select 1 from game_participants gp2
      where gp2.game_id = ratings.game_id and gp2.user_id = ratings.ratee_id
        and gp2.status = 'played')
    and exists (
      select 1 from games g
      where g.id = ratings.game_id and upper(g.during) < now()));

-- Venue reviews: public read, write only if you actually booked it.
create policy reviews_read on venue_reviews for select using (true);
create policy reviews_insert on venue_reviews for insert
  with check (auth.uid() = user_id and exists (
    select 1 from bookings b
    where b.id = booking_id and b.user_id = auth.uid() and b.status = 'completed'));

-- Waitlist: anyone may join, nobody may read it back.
create policy waitlist_insert on waitlist for insert with check (true);

-- ============================================================================
-- REALTIME — this is what makes spots fill live on screen
-- ============================================================================
alter publication supabase_realtime add table game_participants;
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table slots;
