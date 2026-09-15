-- Tighten venue-owner RBAC.
--
-- Before this, owning a venue row was enough to manage venue inventory. That
-- meant any authenticated account that managed to create or inherit a venue
-- could keep acting as supply-side operator even if their profile role was
-- only "player". The app now gates the UI/actions too; this migration makes
-- the database enforce the same boundary.

create or replace function is_venue_owner(p_user uuid default auth.uid())
returns boolean
language sql
stable
as $$
  select exists (
    select 1
      from profiles
     where id = coalesce(p_user, auth.uid())
       and role = 'venue_owner'
       and not suspended
  );
$$;

-- Public discovery remains public. Management requires venue_owner + ownership.
drop policy if exists venues_write on venues;
create policy venues_write on venues for all
  using (auth.uid() = owner_id and is_venue_owner())
  with check (auth.uid() = owner_id and is_venue_owner());

drop policy if exists pitches_write on pitches;
create policy pitches_write on pitches for all
  using (
    exists (
      select 1
        from venues v
       where v.id = venue_id
         and v.owner_id = auth.uid()
         and is_venue_owner()
    )
  )
  with check (
    exists (
      select 1
        from venues v
       where v.id = venue_id
         and v.owner_id = auth.uid()
         and is_venue_owner()
    )
  );

drop policy if exists slots_write on slots;
create policy slots_write on slots for all
  using (
    exists (
      select 1
        from pitches p
        join venues v on v.id = p.venue_id
       where p.id = pitch_id
         and v.owner_id = auth.uid()
         and is_venue_owner()
    )
  )
  with check (
    exists (
      select 1
        from pitches p
        join venues v on v.id = p.venue_id
       where p.id = pitch_id
         and v.owner_id = auth.uid()
         and is_venue_owner()
    )
  );

drop policy if exists bookings_read_venue on bookings;
create policy bookings_read_venue on bookings for select
  using (
    exists (
      select 1
        from slots s
        join pitches p on p.id = s.pitch_id
        join venues v on v.id = p.venue_id
       where s.id = slot_id
         and v.owner_id = auth.uid()
         and is_venue_owner()
    )
  );

drop policy if exists venue_photos_insert_own on storage.objects;
create policy venue_photos_insert_own on storage.objects
  for insert with check (
    bucket_id = 'venue-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and is_venue_owner()
  );

drop policy if exists venue_photos_update_own on storage.objects;
create policy venue_photos_update_own on storage.objects
  for update using (
    bucket_id = 'venue-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and is_venue_owner()
  ) with check (
    bucket_id = 'venue-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and is_venue_owner()
  );

drop policy if exists venue_photos_delete_own on storage.objects;
create policy venue_photos_delete_own on storage.objects
  for delete using (
    bucket_id = 'venue-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and is_venue_owner()
  );

drop policy if exists venue_settlements_read_owner_admin on venue_settlements;
create policy venue_settlements_read_owner_admin on venue_settlements
  for select using (
    is_admin()
    or (owner_id = auth.uid() and is_venue_owner())
  );

drop policy if exists venue_payouts_read_owner_admin on venue_payouts;
create policy venue_payouts_read_owner_admin on venue_payouts
  for select using (
    is_admin()
    or (owner_id = auth.uid() and is_venue_owner())
  );

create or replace function set_slot_status(p_slot_id uuid, p_status slot_status)
returns slots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_slot slots%rowtype;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not is_venue_owner(v_user) then
    raise exception 'venue owner access required' using errcode = '42501';
  end if;
  if p_status not in ('open', 'blocked') then
    raise exception 'invalid status' using errcode = 'P0001';
  end if;

  select s.* into v_slot
    from slots s
    join pitches p on p.id = s.pitch_id
    join venues v on v.id = p.venue_id
   where s.id = p_slot_id and v.owner_id = v_user
   for update;

  if not found then
    raise exception 'slot not found or not yours' using errcode = 'P0002';
  end if;
  if v_slot.status = 'booked' then
    raise exception 'slot is booked -- cancel the booking instead' using errcode = 'P0001';
  end if;

  update slots set status = p_status where id = p_slot_id returning * into v_slot;
  return v_slot;
end;
$$;

grant execute on function is_venue_owner(uuid) to authenticated;
grant execute on function set_slot_status(uuid, slot_status) to authenticated;
