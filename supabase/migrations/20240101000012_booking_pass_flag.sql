-- Add booked_via_pass flag to bookings table
-- Distinguishes pass-based bookings from regular credit/payment bookings

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS booked_via_pass boolean NOT NULL DEFAULT false;
