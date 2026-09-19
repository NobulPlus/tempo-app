-- ============================================================================
-- Match chat + direct messaging + moderation (block/report).
--
-- No membership table for match chat: current game_participants membership
-- IS channel membership, re-checked live on every read/write, same EXISTS-
-- into-game_participants shape as ratings_read (0001_init.sql). DM threads
-- are gated to players who've actually shared a game (host+participant or
-- co-participants at 'confirmed'/'played' — NOT 'pending_payment', which is
-- free and instant to reach and would otherwise let anyone unlock a
-- permanent DM thread with strangers by joining-then-abandoning a game).
-- Moderation (block + report) ships in the same migration, not after —
-- first stranger-to-stranger messaging surface in the app, zero report/
-- block infra existed before this.
-- ============================================================================

create type message_report_status as enum ('pending', 'reviewed', 'dismissed');

-- ---------------------------------------------------------- match chat
create table game_chat_messages (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references games(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  body       text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index game_chat_messages_game_idx on game_chat_messages (game_id, created_at);
create index game_chat_messages_rate_idx on game_chat_messages (user_id, created_at);

alter table game_chat_messages enable row level security;

-- 'played'/'no_show' are included deliberately: a host flips participants to
-- 'played' right when post-match chat ("gg", splitting costs, "next week?")
-- is most likely, and excluding it would silently kill the chat during the
-- exact 48h window the cleanup cron below is built around. 'waitlist' and
-- 'withdrawn' stay excluded — never actually shared the match.
create policy game_chat_messages_read on game_chat_messages for select
  using (
    exists (
      select 1 from game_participants gp
      where gp.game_id = game_chat_messages.game_id
        and gp.user_id = auth.uid()
        and gp.status in ('confirmed', 'pending_payment', 'played', 'no_show')
    )
    or exists (select 1 from games g where g.id = game_chat_messages.game_id and g.host_id = auth.uid())
    or is_admin()
  );

create policy game_chat_messages_insert on game_chat_messages for insert
  with check (
    user_id = auth.uid()
    and not exists (select 1 from profiles where id = auth.uid() and suspended)
    and (
      exists (
        select 1 from game_participants gp
        where gp.game_id = game_chat_messages.game_id
          and gp.user_id = auth.uid()
          and gp.status in ('confirmed', 'pending_payment', 'played', 'no_show')
      )
      or exists (select 1 from games g where g.id = game_chat_messages.game_id and g.host_id = auth.uid())
    )
  );

-- ---------------------------------------------------------- moderation: blocks
create table blocked_users (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocked_users_blocked_idx on blocked_users (blocked_id);

alter table blocked_users enable row level security;

-- Single-owner rows, no cross-cutting invariant — plain RLS, no RPC needed.
create policy blocked_users_read_own on blocked_users for select using (blocker_id = auth.uid());
create policy blocked_users_insert_own on blocked_users for insert with check (blocker_id = auth.uid());
create policy blocked_users_delete_own on blocked_users for delete using (blocker_id = auth.uid());

-- security definer: blocked_users' own RLS only ever exposes rows where
-- *you* are the blocker, so a plain (non-definer) helper called from the
-- other party's session could never see "did they block me" — only "did I
-- block them". This crosses that RLS boundary on purpose, same role
-- is_admin() plays for the profiles.role check elsewhere, except is_admin()
-- gets away without security definer only because profiles is public-read.
create or replace function is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from blocked_users
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

revoke all on function is_blocked_between(uuid, uuid) from public, anon;
grant execute on function is_blocked_between(uuid, uuid) to authenticated;

-- ---------------------------------------------------------- direct messages
create table dm_threads (
  id                   uuid primary key default gen_random_uuid(),
  user_a               uuid not null references profiles(id) on delete cascade,
  user_b               uuid not null references profiles(id) on delete cascade,
  created_at           timestamptz not null default now(),
  last_message_at      timestamptz not null default now(),
  user_a_last_read_at  timestamptz,
  user_b_last_read_at  timestamptz,
  check (user_a < user_b),
  unique (user_a, user_b)
);

alter table dm_threads enable row level security;

create policy dm_threads_read on dm_threads for select using (auth.uid() in (user_a, user_b));
-- No insert policy: only get_or_create_dm_thread() (below) can create a
-- thread, so the "shared a game together" gate can never be bypassed by a
-- direct client insert.

create table dm_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references dm_threads(id) on delete cascade,
  sender_id  uuid not null references profiles(id) on delete cascade,
  body       text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index dm_messages_thread_idx on dm_messages (thread_id, created_at);
create index dm_messages_rate_idx on dm_messages (sender_id, created_at);

alter table dm_messages enable row level security;

create policy dm_messages_read on dm_messages for select
  using (exists (select 1 from dm_threads t where t.id = dm_messages.thread_id and auth.uid() in (t.user_a, t.user_b)));

create policy dm_messages_insert on dm_messages for insert
  with check (
    sender_id = auth.uid()
    and not exists (select 1 from profiles where id = auth.uid() and suspended)
    and exists (
      select 1 from dm_threads t
      where t.id = dm_messages.thread_id
        and auth.uid() in (t.user_a, t.user_b)
        and not is_blocked_between(auth.uid(), case when t.user_a = auth.uid() then t.user_b else t.user_a end)
    )
  );

-- security definer for two reasons: (1) dm_threads has no INSERT policy for
-- authenticated at all, so only a definer function can write the row; (2)
-- the eligibility check needs to read blocked_users rows where the OTHER
-- person is the blocker, which is invisible under that table's own RLS from
-- the caller's session.
create or replace function get_or_create_dm_thread(p_other_user_id uuid)
returns dm_threads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_a    uuid;
  v_b    uuid;
  v_row  dm_threads%rowtype;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_other_user_id = v_user then
    raise exception 'cannot message yourself' using errcode = 'P0001';
  end if;
  if exists (select 1 from profiles where id = v_user and suspended) then
    raise exception 'account suspended' using errcode = '42501';
  end if;

  v_a := least(v_user, p_other_user_id);
  v_b := greatest(v_user, p_other_user_id);

  -- Eligibility gates creation, not continued existence: check for an
  -- existing thread first and short-circuit, cheaper than re-running the
  -- eligibility scan on every open, and correct if eligibility could ever
  -- change retroactively (it shouldn't, but this way it doesn't matter).
  select * into v_row from dm_threads where user_a = v_a and user_b = v_b;
  if found then
    return v_row;
  end if;

  if exists (select 1 from profiles where id = p_other_user_id and suspended) then
    raise exception 'that account is suspended' using errcode = 'P0001';
  end if;

  if is_blocked_between(v_user, p_other_user_id) then
    raise exception 'cannot message this player' using errcode = 'P0001';
  end if;

  -- Shared-game eligibility: both were real participants together at
  -- 'confirmed'/'played' (not 'pending_payment' — see migration header), or
  -- one hosted a game the other actually played in.
  if not (
    exists (
      select 1 from game_participants gp1
      join game_participants gp2 on gp1.game_id = gp2.game_id
      where gp1.user_id = v_a and gp2.user_id = v_b
        and gp1.status in ('confirmed', 'played') and gp2.status in ('confirmed', 'played')
    )
    or exists (
      select 1 from games g join game_participants gp on gp.game_id = g.id
      where ((g.host_id = v_a and gp.user_id = v_b) or (g.host_id = v_b and gp.user_id = v_a))
        and gp.status in ('confirmed', 'played')
    )
  ) then
    raise exception 'you can only message players you have shared a game with' using errcode = 'P0001';
  end if;

  insert into dm_threads (user_a, user_b) values (v_a, v_b)
    on conflict (user_a, user_b) do nothing
    returning * into v_row;

  if not found then
    select * into v_row from dm_threads where user_a = v_a and user_b = v_b;
  end if;

  return v_row;
end;
$$;

grant execute on function get_or_create_dm_thread(uuid) to authenticated;

create or replace function mark_dm_thread_read(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update dm_threads set
    user_a_last_read_at = case when user_a = auth.uid() then now() else user_a_last_read_at end,
    user_b_last_read_at = case when user_b = auth.uid() then now() else user_b_last_read_at end
  where id = p_thread_id and auth.uid() in (user_a, user_b);
end;
$$;

grant execute on function mark_dm_thread_read(uuid) to authenticated;

-- Not security definer: the query already self-filters to auth.uid()'s own
-- threads, which dm_threads_read RLS already permits directly — no RLS
-- boundary to cross here, unlike is_blocked_between.
create or replace function get_unread_dm_thread_count()
returns integer
language sql
stable
set search_path = public
as $$
  select count(*)::int from dm_threads
  where auth.uid() in (user_a, user_b)
    and last_message_at > coalesce(
      case when user_a = auth.uid() then user_a_last_read_at else user_b_last_read_at end,
      'epoch'::timestamptz
    );
$$;

grant execute on function get_unread_dm_thread_count() to authenticated;

-- Keeps last_message_at in sync without every writer having to remember to
-- set it — same denormalized-column-via-trigger shape as balance_after_kobo
-- elsewhere in this codebase, just via trigger instead of inline in an RPC
-- since the insert here is direct RLS, not an RPC.
create or replace function touch_dm_thread_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update dm_threads set last_message_at = new.created_at where id = new.thread_id;
  return new;
end;
$$;

create trigger dm_messages_touch_thread
  after insert on dm_messages
  for each row execute function touch_dm_thread_last_message();

-- ---------------------------------------------------------- spam guard
-- Burst guard, not a business invariant, so a plain trigger rather than
-- forcing the insert path through an RPC just for rate-limiting.
create or replace function check_message_burst_limit()
returns trigger
language plpgsql
as $$
declare
  v_count int;
  v_user  uuid;
begin
  -- IF/ELSE, not a CASE expression: each branch is a separate plpgsql
  -- statement resolved against NEW's actual row type only when it runs, so
  -- referencing new.user_id (game_chat_messages) and new.sender_id
  -- (dm_messages) in the same shared trigger function is safe here. A single
  -- CASE expression referencing both fields would fail at runtime on
  -- whichever table doesn't have that column, since it's compiled as one
  -- SQL expression regardless of which branch is logically taken.
  if TG_TABLE_NAME = 'game_chat_messages' then
    v_user := new.user_id;
    select count(*) into v_count from game_chat_messages
      where user_id = v_user and created_at > now() - interval '10 seconds';
  else
    v_user := new.sender_id;
    select count(*) into v_count from dm_messages
      where sender_id = v_user and created_at > now() - interval '10 seconds';
  end if;

  if v_count >= 8 then
    raise exception 'sending too fast — slow down' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger game_chat_messages_burst_guard
  before insert on game_chat_messages
  for each row execute function check_message_burst_limit();

create trigger dm_messages_burst_guard
  before insert on dm_messages
  for each row execute function check_message_burst_limit();

-- ---------------------------------------------------------- moderation: reports
-- Deliberately NOT a hard FK-with-cascade to the message tables:
-- game_chat_messages rows get purged 48h after the match (see the cron
-- function below), which would silently destroy report evidence via
-- cascade. message_snapshot copies the body at report time instead.
create table message_reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references profiles(id) on delete cascade,
  reported_user_id uuid not null references profiles(id) on delete cascade,
  source           text not null check (source in ('game_chat', 'direct_message')),
  context_id       uuid not null,
  message_snapshot text not null,
  reason           text not null check (length(btrim(reason)) between 1 and 500),
  status           message_report_status not null default 'pending',
  reviewed_by      uuid references profiles(id),
  reviewed_at      timestamptz,
  review_note      text,
  created_at       timestamptz not null default now()
);

create index message_reports_status_idx on message_reports (status, created_at desc);

alter table message_reports enable row level security;

create policy message_reports_insert_own on message_reports for insert with check (reporter_id = auth.uid());
create policy message_reports_read_own on message_reports for select using (reporter_id = auth.uid());
create policy message_reports_admin_read on message_reports for select using (is_admin());

create or replace function admin_review_message_report(p_report_id uuid, p_action text, p_note text)
returns message_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row message_reports%rowtype;
begin
  if not is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_action not in ('dismiss', 'suspend_user') then
    raise exception 'unknown action' using errcode = 'P0001';
  end if;

  update message_reports
     set status      = case when p_action = 'suspend_user' then 'reviewed' else 'dismissed' end,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_note = p_note
   where id = p_report_id
   returning * into v_row;

  if not found then
    raise exception 'report not found' using errcode = 'P0002';
  end if;

  if p_action = 'suspend_user' then
    perform admin_set_suspended(v_row.reported_user_id, true);
  end if;

  return v_row;
end;
$$;

grant execute on function admin_review_message_report(uuid, text, text) to authenticated;

-- ---------------------------------------------------------- realtime
alter publication supabase_realtime add table game_chat_messages;
alter publication supabase_realtime add table dm_messages;

-- ---------------------------------------------------------- cleanup cron
-- Service-role only, same revoke/grant pattern as expire_unpaid_game_holds.
create or replace function delete_expired_game_chat_messages()
returns integer
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from game_chat_messages
    where game_id in (select id from games where ends_at < now() - interval '48 hours')
    returning 1
  )
  select count(*)::int from deleted;
$$;

revoke all on function delete_expired_game_chat_messages() from public, authenticated, anon;
grant execute on function delete_expired_game_chat_messages() to service_role;
