-- Add preference flag so owners/managers can opt out of instructor-booking notices.
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS email_instructor_bookings boolean DEFAULT true;
