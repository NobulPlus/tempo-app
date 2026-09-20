-- require_profile_photo_for_marketplace_action() (0048) used a single CASE
-- expression referencing both new.user_id (bookings) and new.host_id
-- (games) to pick the right column per table. Postgres resolves every
-- branch of a CASE expression against the actual row type before picking
-- one, so this raised "record 'new' has no field ...' on EVERY booking
-- (games has no user_id) and EVERY new hosted game (bookings has no
-- host_id) — a complete outage of both core marketplace actions since 0048
-- shipped, caught by live verification, not just the photo-lockout this
-- migration was already fixing. Same fix pattern as the identical bug
-- already caught and fixed this session in check_message_burst_limit()
-- (0046): IF/ELSE branches resolve NEW's fields lazily per branch; a CASE
-- expression does not.
create or replace function require_profile_photo_for_marketplace_action()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  if TG_TABLE_NAME = 'bookings' then
    v_user := new.user_id;
  else
    v_user := new.host_id;
  end if;

  if exists (select 1 from profiles where id = v_user and created_at >= '2026-09-20T16:02:06Z'::timestamptz)
     and not exists (
       select 1 from profiles where id = v_user and nullif(trim(coalesce(avatar_url, '')), '') is not null
     )
  then
    raise exception 'add a clear profile photo before booking or hosting' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
