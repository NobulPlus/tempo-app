-- 0048's profile-photo requirement shipped with no grace period: every
-- existing account (all 17 real users at the time this was caught, zero of
-- whom had ever had a photo feature to use before that same session) was
-- immediately locked out of booking, hosting, and joining games the moment
-- it went live. Confirmed live in production before this fix. Grandfathers
-- every account that existed before this fix ships — the requirement now
-- only applies to accounts created after this cutoff, i.e. new signups.
-- The cutoff is a fixed literal (not now() evaluated per-call) so it can
-- never silently drift as time passes.

create or replace function require_profile_photo_for_game_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
begin
  if TG_OP = 'UPDATE' and not (old.status = 'withdrawn' and new.status in ('confirmed', 'pending_payment', 'waitlist')) then
    return new;
  end if;
  select host_id into v_host from games where id = new.game_id;
  if new.user_id <> v_host and exists (
    select 1 from host_player_exclusions where host_id = v_host and player_id = new.user_id
  ) then
    raise exception 'this host is not accepting you into future games' using errcode = 'P0001';
  end if;
  if new.user_id <> v_host
     and exists (select 1 from profiles where id = new.user_id and created_at >= '2026-09-20T16:02:06Z'::timestamptz)
     and not exists (
       select 1 from profiles where id = new.user_id and nullif(trim(coalesce(avatar_url, '')), '') is not null
     )
  then
    raise exception 'add a clear profile photo before joining a game' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function require_profile_photo_for_marketplace_action()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := case when TG_TABLE_NAME = 'bookings' then new.user_id else new.host_id end;
begin
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
