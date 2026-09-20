-- 0051 redefined can_manage_game_attendance(game_id, user) and, unlike the
-- original 0030 definition (deliberately revoke all from
-- authenticated/anon/public, internal-only, callable only from inside
-- mark_game_attendance), granted it to `authenticated`. That function
-- returns a plain boolean for an ARBITRARY p_user, so any signed-in player
-- could call it directly via the REST RPC endpoint with someone else's
-- user id and a venue's game id to probe whether that person is the venue's
-- staff/owner/host/admin -- a side channel around venue_staff's own RLS,
-- which deliberately restricts reads to self/owner/admin. The two
-- legitimate callers (mark_game_attendance's internal check, and
-- canManageGameAttendance() in repo.ts, called server-side with the
-- signed-in user's own id) always pass p_user = auth.uid(), so restricting
-- self-only (or admin) queries breaks neither.
create or replace function can_manage_game_attendance(p_game_id uuid, p_user uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user <> auth.uid() and not is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return exists (
    select 1 from games g
    join pitches p on p.id = g.pitch_id
    join venues v on v.id = p.venue_id
    where g.id = p_game_id and (
      g.host_id = p_user or v.owner_id = p_user or is_admin()
      or exists (select 1 from venue_staff vs where vs.venue_id = v.id and vs.user_id = p_user)
    )
  );
end;
$$;
