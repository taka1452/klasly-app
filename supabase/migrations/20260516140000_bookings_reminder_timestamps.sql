-- Track which booking reminder emails have been sent so the hourly
-- cron (T1-3) doesn't double-send. Two windows: 24h-before and
-- 1h-before. Hourly cron picks up bookings whose session falls in
-- either window and whose corresponding timestamp is still null.
alter table public.bookings
  add column if not exists reminder_24h_sent_at timestamptz,
  add column if not exists reminder_1h_sent_at timestamptz;

create index if not exists idx_bookings_reminder_24h_null
  on public.bookings (status)
  where reminder_24h_sent_at is null;

create index if not exists idx_bookings_reminder_1h_null
  on public.bookings (status)
  where reminder_1h_sent_at is null;
