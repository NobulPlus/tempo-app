-- Venue owner applications.
--
-- Anonymous /partner leads still exist for visitors, but signed-in users now
-- submit a real application with review status. Approval grants the
-- venue_owner role in the same transaction, so admin does not need to review
-- an application and then remember to edit the user separately.

create table if not exists venue_owner_applications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references profiles(id) on delete cascade,
  venue_name  text not null,
  area        text not null,
  address     text not null,
  phone       text,
  notes       text,
  status      text not null default 'pending',
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at  timestamptz not null default now(),
  constraint venue_owner_applications_status_valid
    check (status in ('pending', 'approved', 'rejected')),
  constraint venue_owner_applications_venue_name_not_blank
    check (length(trim(venue_name)) > 0),
  constraint venue_owner_applications_area_not_blank
    check (length(trim(area)) > 0),
  constraint venue_owner_applications_address_not_blank
    check (length(trim(address)) > 0)
);

create index if not exists venue_owner_applications_user_created_idx
  on venue_owner_applications (user_id, created_at desc);

create index if not exists venue_owner_applications_status_created_idx
  on venue_owner_applications (status, created_at desc);

create unique index if not exists venue_owner_applications_one_pending_per_user
  on venue_owner_applications (user_id)
  where status = 'pending';

alter table venue_owner_applications enable row level security;

create policy venue_owner_applications_read_own
  on venue_owner_applications for select
  using (auth.uid() = user_id);

create policy venue_owner_applications_insert_own
  on venue_owner_applications for insert
  with check (
    auth.uid() = user_id
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
  );

create policy venue_owner_applications_admin_read
  on venue_owner_applications for select
  using (is_admin());

create or replace function admin_review_venue_owner_application(
  p_application_id uuid,
  p_approve        boolean,
  p_note           text
)
returns venue_owner_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row venue_owner_applications%rowtype;
begin
  if not is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update venue_owner_applications
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_note = nullif(p_note, '')
   where id = p_application_id
     and status = 'pending'
   returning * into v_row;

  if not found then
    raise exception 'application not found or already reviewed' using errcode = 'P0002';
  end if;

  if p_approve then
    update profiles set role = 'venue_owner' where id = v_row.user_id;
  end if;

  return v_row;
end;
$$;

grant execute on function admin_review_venue_owner_application(uuid, boolean, text) to authenticated;
