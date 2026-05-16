-- Pass freeze / vacation hold (T2-5). Member pauses their pass for a
-- period; bookings are blocked during the hold and the period_end is
-- extended by the held duration when unfrozen so they don't lose days.
--
-- Approach: store a single active freeze window per subscription. When
-- frozen_at IS NOT NULL the pass behaves as paused. A daily cron (or
-- the unfreeze action) computes the elapsed freeze days and shifts
-- current_period_end forward.
alter table public.pass_subscriptions
  add column if not exists frozen_at timestamptz,
  add column if not exists frozen_until date,
  add column if not exists total_frozen_days integer not null default 0;

create index if not exists idx_pass_subscriptions_frozen
  on public.pass_subscriptions (frozen_at)
  where frozen_at is not null;
