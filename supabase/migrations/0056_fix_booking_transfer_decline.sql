-- cancel_booking_transfer_offer() only let the original booker (from_user_id)
-- rescind an open offer. The UI also uses it as "Decline" for the recipient
-- (to_user_id) -- who would silently no-op (Postgres/Supabase report success
-- with zero rows affected, not an error, when a WHERE clause matches
-- nothing), leaving the UI claiming "Declined" while the offer stayed open.
-- Either party can call off an open offer.
create or replace function cancel_booking_transfer_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  update booking_transfer_offers set status = 'cancelled', updated_at = now()
   where id = p_offer_id
     and status = 'open'
     and auth.uid() in (from_user_id, to_user_id);
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'that offer cannot be cancelled' using errcode = 'P0001';
  end if;
end;
$$;
