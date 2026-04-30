-- Allow owners / managers / instructors to record an optional reason when
-- they cancel a class session. The reason is shown to affected members on
-- the schedule view and in the auto-sent cancellation email so they don't
-- have to guess why their booking disappeared.

ALTER TABLE class_sessions
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
