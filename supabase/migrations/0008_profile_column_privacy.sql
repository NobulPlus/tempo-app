-- ============================================================================
-- profiles_read (0001_init.sql) is `using (true)` — deliberately public, since
-- player cards are meant to be public. But RLS is row-level only; it can't
-- restrict which columns a public SELECT returns, and profiles.phone is
-- sitting right there in the same row as everything else. Any anon or
-- authenticated client could already do `select('phone').from('profiles')`
-- and read every player's phone number.
--
-- Same technique 0002_auth_hardening.sql already used for locking down
-- UPDATE on role/suspended — column-level GRANT/REVOKE, not RLS — applied
-- here to SELECT instead. Confirmed (grep) that no client code currently
-- reads a profile's own `.phone` back (only venues.phone, a different,
-- intentionally-public table, is used), so this is safe to do with a plain
-- column allowlist: getCurrentUser()'s existing `select("*")` in
-- src/lib/session.ts keeps working unchanged — Postgres silently narrows
-- `SELECT *` to the columns the caller has privilege on rather than erroring.
-- ============================================================================

revoke select on profiles from authenticated, anon;

grant select (
  id, handle, full_name, avatar_url, area, side, position, foot, bio, role,
  games_played, punctuality_score, streak_weeks, longest_streak_weeks,
  motm_count, peer_rating, peer_rating_count,
  trait_pace, trait_passing, trait_finishing, trait_defending, trait_stamina, trait_teamwork,
  last_played_at, created_at, suspended
) on profiles to authenticated, anon;
