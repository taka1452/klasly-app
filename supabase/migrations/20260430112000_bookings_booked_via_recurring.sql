-- Marks a booking as having been auto-created by a recurring rule, so we
-- can distinguish the two flows when reviewing booking history. Defaults
-- to FALSE so existing bookings (and manual ones) stay unaffected.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS booked_via_recurring BOOLEAN NOT NULL DEFAULT FALSE;
