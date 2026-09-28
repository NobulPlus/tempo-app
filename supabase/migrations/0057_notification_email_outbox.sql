-- Database-triggered product updates are delivered by the existing scheduled
-- game-payment-holds route. This timestamp makes the delivery idempotent and
-- lets a transient email-provider failure retry on the next run.

alter table user_notifications
  add column if not exists email_sent_at timestamptz;

create index if not exists user_notifications_email_outbox_idx
  on user_notifications (kind, created_at)
  where email_sent_at is null;
