-- Email capture for the production coming-soon page. Kept separate from the
-- existing `waitlist` table (area-expansion interest) since these are
-- launch-notify subscribers specifically, a different audience to message.

create table launch_notify_signups (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  created_at timestamptz not null default now()
);

alter table launch_notify_signups enable row level security;

create policy launch_notify_signups_insert on launch_notify_signups for insert with check (true);
create policy launch_notify_signups_admin_read on launch_notify_signups for select using (is_admin());
