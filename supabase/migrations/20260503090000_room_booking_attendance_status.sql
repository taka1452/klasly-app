-- Sarah Haroldsen feedback (2026-05): no-show / late cancel must work for
-- room bookings (her core flow: 1:1 body therapy / reiki). Mirrors the
-- bookings.attendance_status column on class sessions.

ALTER TABLE class_sessions
  ADD COLUMN IF NOT EXISTS client_attendance_status text;

ALTER TABLE class_sessions
  DROP CONSTRAINT IF EXISTS class_sessions_client_attendance_status_check;

ALTER TABLE class_sessions
  ADD CONSTRAINT class_sessions_client_attendance_status_check
  CHECK (client_attendance_status IS NULL OR client_attendance_status IN ('no_show','late_cancel'));
