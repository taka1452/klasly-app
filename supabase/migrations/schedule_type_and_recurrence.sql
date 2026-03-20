-- Classes: add schedule_type (recurring / one_time) and one_time_date
ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS schedule_type text NOT NULL DEFAULT 'recurring'
    CHECK (schedule_type IN ('recurring', 'one_time'));

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS one_time_date date DEFAULT NULL;

-- Make day_of_week nullable (was NOT NULL for recurring-only)
ALTER TABLE classes ALTER COLUMN day_of_week DROP NOT NULL;

-- Enforce: recurring requires day_of_week, one_time requires one_time_date
ALTER TABLE classes
  ADD CONSTRAINT classes_schedule_check CHECK (
    (schedule_type = 'recurring' AND day_of_week IS NOT NULL) OR
    (schedule_type = 'one_time' AND one_time_date IS NOT NULL)
  );

-- Room bookings: add recurrence columns
ALTER TABLE instructor_room_bookings
  ADD COLUMN IF NOT EXISTS recurrence_group_id uuid DEFAULT NULL;

ALTER TABLE instructor_room_bookings
  ADD COLUMN IF NOT EXISTS day_of_week smallint DEFAULT NULL
    CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6));

CREATE INDEX IF NOT EXISTS idx_room_bookings_recurrence_group
  ON instructor_room_bookings(recurrence_group_id)
  WHERE recurrence_group_id IS NOT NULL;
