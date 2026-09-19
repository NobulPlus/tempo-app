-- 0033_venue_owner_rbac.sql gated venue management behind profiles.role = 'venue_owner',
-- but never backfilled that role for accounts that already held venues.owner_id from
-- before RBAC existed. Confirmed live: at least one existing venue owner's role was
-- still 'player', locking them out of their own venue/pitches/slots/bookings with no
-- self-service recovery. This backfills the role for every current owner_id holder.

update profiles
set role = 'venue_owner'
where id in (select distinct owner_id from venues where owner_id is not null)
  and role <> 'venue_owner';
