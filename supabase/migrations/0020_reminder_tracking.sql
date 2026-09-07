-- ============================================================================
-- Dedupe columns for the booking/game kickoff-reminder cron
-- (src/app/api/cron/reminders/route.ts). A cron tick that overlaps a
-- previous one, or runs late, must never double-send — each row remembers
-- whether its 1h/30m reminder already went out.
--
-- No RLS changes: only the cron route (service-role client) ever writes
-- these, bypassing RLS entirely, same trust boundary complete_wallet_topup()
-- already relies on. Not sensitive enough to need a read policy beyond
-- whatever already covers bookings/game_participants.
-- ============================================================================

alter table bookings add column if not exists reminder_1h_sent_at timestamptz;
alter table bookings add column if not exists reminder_30m_sent_at timestamptz;

alter table game_participants add column if not exists reminder_1h_sent_at timestamptz;
alter table game_participants add column if not exists reminder_30m_sent_at timestamptz;
