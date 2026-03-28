-- ============================================================
-- Retreat LP Enhancements
-- Adds gallery, schedule, packing list, access info, and map coordinates
-- ============================================================

-- 1. Extend events table with LP enhancement columns
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS gallery_images jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS packing_list jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS access_info text,
  ADD COLUMN IF NOT EXISTS location_lat double precision,
  ADD COLUMN IF NOT EXISTS location_lng double precision,
  ADD COLUMN IF NOT EXISTS waitlist_enabled boolean NOT NULL DEFAULT false;

-- Add comments for clarity
COMMENT ON COLUMN events.gallery_images IS 'Array of image URL strings for the photo gallery';
COMMENT ON COLUMN events.packing_list IS 'Array of {item: string, category?: string} objects';
COMMENT ON COLUMN events.access_info IS 'Free-text access/travel information shown on the LP';
COMMENT ON COLUMN events.location_lat IS 'Latitude for Google Maps embed (optional)';
COMMENT ON COLUMN events.location_lng IS 'Longitude for Google Maps embed (optional)';
COMMENT ON COLUMN events.waitlist_enabled IS 'Whether waitlist is enabled when sold out';

-- 2. Event schedule items (daily timetable)
CREATE TABLE IF NOT EXISTS event_schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  day_number integer NOT NULL,
  start_time time,
  end_time time,
  title text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_schedule_items_event
  ON event_schedule_items(event_id, day_number, sort_order);

COMMENT ON TABLE event_schedule_items IS 'Daily schedule/timetable for retreats shown on the LP';
COMMENT ON COLUMN event_schedule_items.day_number IS '1-based day number (Day 1, Day 2, etc.)';

-- 3. Early bird pricing on event_options
ALTER TABLE event_options
  ADD COLUMN IF NOT EXISTS early_bird_price_cents integer,
  ADD COLUMN IF NOT EXISTS early_bird_deadline timestamptz;

COMMENT ON COLUMN event_options.early_bird_price_cents IS 'Discounted price available before the deadline';
COMMENT ON COLUMN event_options.early_bird_deadline IS 'Deadline after which the regular price applies';

-- 4. Group booking support on event_bookings
ALTER TABLE event_bookings
  ADD COLUMN IF NOT EXISTS group_size integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS group_members jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN event_bookings.group_size IS 'Number of people in this booking (1 = solo)';
COMMENT ON COLUMN event_bookings.group_members IS 'Array of {name, email} for additional group members';

-- 5. Waitlist status for event_bookings
-- Add 'waitlisted' to the booking_status check constraint
ALTER TABLE event_bookings DROP CONSTRAINT IF EXISTS event_bookings_booking_status_check;
ALTER TABLE event_bookings ADD CONSTRAINT event_bookings_booking_status_check
  CHECK (booking_status IN ('pending_payment','confirmed','completed','cancelled','waitlisted'));

-- ============================================================
-- RLS for event_schedule_items
-- ============================================================
ALTER TABLE event_schedule_items ENABLE ROW LEVEL SECURITY;

-- Public can read schedule items for published public events
CREATE POLICY event_schedule_items_public_read ON event_schedule_items
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE is_public = true AND status = 'published')
  );

-- Studio members can read all schedule items for their studio's events
CREATE POLICY event_schedule_items_studio_read ON event_schedule_items
  FOR SELECT USING (
    event_id IN (
      SELECT id FROM events WHERE studio_id IN (
        SELECT studio_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Owner/manager full access
CREATE POLICY event_schedule_items_manage ON event_schedule_items
  FOR ALL USING (
    event_id IN (
      SELECT id FROM events WHERE studio_id IN (
        SELECT studio_id FROM profiles
        WHERE id = auth.uid() AND role IN ('owner','manager')
      )
    )
  );

-- Service role bypass
CREATE POLICY event_schedule_items_service ON event_schedule_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);
