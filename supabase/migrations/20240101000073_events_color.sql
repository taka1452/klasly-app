-- Allow owners to tag each event with a color so it stands out on the schedule.
-- Requested by Sunrise Yoga Studio (Jamie feedback 2026-04).
-- Stored as a 7-character hex string (e.g. "#0074c5"); NULL means "use default brand color".
ALTER TABLE events ADD COLUMN IF NOT EXISTS color TEXT
  CHECK (color IS NULL OR color ~ '^#[0-9a-fA-F]{6}$');
