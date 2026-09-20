-- Scan-to-check-in and delegated venue attendance access.

create table venue_staff (
  venue_id uuid not null references venues(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (venue_id, user_id)
);

alter table venue_staff enable row level security;
create policy venue_staff_read_owner_or_self on venue_staff for select using (
  user_id = auth.uid()
  or exists (select 1 from venues v where v.id = venue_staff.venue_id and v.owner_id = auth.uid())
  or is_admin()
);
revoke all on venue_staff from anon, authenticated;
grant select on venue_staff to authenticated;

create or replace function set_venue_staff(p_venue_id uuid, p_handle text, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_staff uuid;
begin
  if v_owner is null or not exists (select 1 from venues where id = p_venue_id and owner_id = v_owner) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select id into v_staff from profiles where lower(handle) = lower(trim(regexp_replace(p_handle, '^@', '')));
  if not found then raise exception 'no Tempo account found for that handle' using errcode = 'P0002'; end if;
  if v_staff = v_owner then raise exception 'you already manage this venue' using errcode = 'P0001'; end if;
  if p_active then
    insert into venue_staff (venue_id, user_id) values (p_venue_id, v_staff) on conflict do nothing;
  else
    delete from venue_staff where venue_id = p_venue_id and user_id = v_staff;
  end if;
end;
$$;
grant execute on function set_venue_staff(uuid, text, boolean) to authenticated;

create or replace function can_manage_game_attendance(p_game_id uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from games g
    join pitches p on p.id = g.pitch_id
    join venues v on v.id = p.venue_id
    where g.id = p_game_id and (
      g.host_id = p_user or v.owner_id = p_user or is_admin()
      or exists (select 1 from venue_staff vs where vs.venue_id = v.id and vs.user_id = p_user)
    )
  );
$$;
grant execute on function can_manage_game_attendance(uuid, uuid) to authenticated;

create policy game_check_in_codes_read_venue_staff on game_participant_check_in_codes
  for select using (
    exists (
      select 1 from games g join pitches p on p.id = g.pitch_id
      join venue_staff vs on vs.venue_id = p.venue_id
      where g.id = game_participant_check_in_codes.game_id and vs.user_id = auth.uid()
    )
  );
