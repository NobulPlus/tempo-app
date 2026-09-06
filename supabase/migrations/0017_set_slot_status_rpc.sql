-- ============================================================================
-- Fixes a real bug: setSlotStatus() was a plain `.update()` with no guard
-- against mutating a booked slot. The "can't toggle a booked slot" logic
-- in SlotList only disables the button client-side — the action and repo
-- function underneath do no check, and slots_write RLS only verifies venue
-- ownership, never the slot's current status. Anyone who can reach
-- setSlotStatusAction with a booked slot's id (not secret — rendered
-- client-side) could flip it to open/blocked, silently orphaning a paid,
-- confirmed booking.
--
-- Fix: same treatment create_booking()/cancel_booking() already got —
-- lock the row, check ownership and state inside a security definer
-- function, not a bare client-callable table update.
-- ============================================================================

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
    raise exception 'slot is booked — cancel the booking instead' using errcode = 'P0001';
  end if;

  update slots set status = p_status where id = p_slot_id returning * into v_slot;
  return v_slot;
end;
$$;

grant execute on function set_slot_status(uuid, slot_status) to authenticated;
