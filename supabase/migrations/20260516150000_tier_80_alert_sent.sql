-- Track when we last sent the 80% threshold alert to each instructor
-- membership so the cron only fires once per period (T2-3).
alter table public.instructor_memberships
  add column if not exists tier_80_alert_sent_at timestamptz;
