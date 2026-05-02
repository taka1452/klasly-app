-- Sarah Haroldsen feedback (2026-05): owners need to mark a booked client as
-- no-show or late cancel from the session detail page so studio reports
-- distinguish them from attendees.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS attendance_status text;

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_attendance_status_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_attendance_status_check
  CHECK (attendance_status IS NULL OR attendance_status IN ('no_show','late_cancel'));
