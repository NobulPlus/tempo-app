-- Pre-existing bug, present since 0001_init.sql, found by live-testing the
-- new waitlist feature: bookings.slot_id had a plain `unique` constraint
-- (not scoped to active bookings), so once ANY booking was ever cancelled
-- for a slot, that slot could never be booked by anyone again — the
-- cancelled row stays in the table forever and blocks any future insert
-- for that slot_id, even though cancel_booking() correctly reopens the
-- slot's own status to 'open'. This has been live since launch; it just
-- happened to surface now because the new waitlist-promotion path is the
-- first thing to actually try re-booking a just-cancelled slot end to end.
--
-- Fix: a slot should only be unique among bookings that currently HOLD it
-- (pending/confirmed) — cancelled/refunded/completed bookings are history,
-- not a claim on the slot.
alter table bookings drop constraint bookings_slot_id_key;
create unique index bookings_slot_active_unique on bookings (slot_id) where status in ('pending', 'confirmed');
