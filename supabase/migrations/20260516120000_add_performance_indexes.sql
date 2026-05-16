-- Performance indexes for frequently queried columns
-- Identified via query pattern audit across API routes, cron jobs, and admin pages

-- studios: admin dashboard filters on (is_demo, plan_status) in 10+ queries
CREATE INDEX IF NOT EXISTS idx_studios_is_demo_plan_status
  ON studios(is_demo, plan_status);

-- webhook_logs: metrics dashboard counts by (status, created_at)
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status_created
  ON webhook_logs(status, created_at DESC);

-- email_logs: admin logs page filters by template
CREATE INDEX IF NOT EXISTS idx_email_logs_template
  ON email_logs(template);

-- event_payment_schedule: cron job filters (status, due_date) every run
CREATE INDEX IF NOT EXISTS idx_event_payment_schedule_status_due
  ON event_payment_schedule(status, due_date)
  WHERE status = 'pending';

-- pass_subscriptions: passes page counts active subs per pass
CREATE INDEX IF NOT EXISTS idx_pass_subscriptions_active
  ON pass_subscriptions(studio_pass_id)
  WHERE status = 'active';

-- payments: dashboard revenue queries filter (studio_id, status, paid_at)
CREATE INDEX IF NOT EXISTS idx_payments_studio_paid
  ON payments(studio_id, status, paid_at DESC)
  WHERE status = 'paid';

-- bookings: dashboard counts confirmed bookings per session
CREATE INDEX IF NOT EXISTS idx_bookings_session_confirmed
  ON bookings(session_id)
  WHERE status = 'confirmed';

-- class_sessions: dashboard today's classes filter
CREATE INDEX IF NOT EXISTS idx_class_sessions_studio_date
  ON class_sessions(studio_id, session_date)
  WHERE is_cancelled = false;
