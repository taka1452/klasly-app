-- ============================================================
-- Event Application Fields
-- Allows event creators to add custom questions (e.g. dietary
-- restrictions, experience level) that guests answer at checkout.
-- ============================================================

-- Add application_fields to events (jsonb array of field definitions)
ALTER TABLE events ADD COLUMN IF NOT EXISTS application_fields jsonb DEFAULT '[]';

-- Add application_responses to event_bookings (jsonb of guest answers)
ALTER TABLE event_bookings ADD COLUMN IF NOT EXISTS application_responses jsonb DEFAULT NULL;
