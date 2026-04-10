-- ============================================================
-- Events & Retreats — 4 tables
-- ============================================================

-- 1. events
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  instructor_id uuid REFERENCES instructors(id) ON DELETE SET NULL,

  -- Basic info
  name text NOT NULL,
  description text,
  location_name text,
  location_address text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  image_url text,

  -- Settings
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','sold_out','completed','cancelled')),
  is_public boolean NOT NULL DEFAULT true,
  payment_type text NOT NULL DEFAULT 'full'
    CHECK (payment_type IN ('full','installment')),
  installment_count integer NOT NULL DEFAULT 3,

  -- Cancellation
  cancellation_policy jsonb DEFAULT '[]'::jsonb,
  cancellation_policy_text text,

  -- Capacity
  max_total_capacity integer,

  -- Custom form
  custom_form_id uuid,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. event_options (room/tier options)
CREATE TABLE IF NOT EXISTS event_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL DEFAULT 0,
  capacity integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. event_bookings
CREATE TABLE IF NOT EXISTS event_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  event_option_id uuid REFERENCES event_options(id) ON DELETE SET NULL,

  -- Booker
  member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  guest_name text,
  guest_email text NOT NULL,
  guest_phone text,

  -- Status
  booking_status text NOT NULL DEFAULT 'pending_payment'
    CHECK (booking_status IN ('pending_payment','confirmed','completed','cancelled')),

  -- Payment
  total_amount_cents integer NOT NULL DEFAULT 0,
  payment_type text NOT NULL DEFAULT 'full'
    CHECK (payment_type IN ('full','installment')),
  payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','partial','fully_paid','refunded')),

  -- Custom form
  form_response_id uuid,

  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. event_payment_schedule
CREATE TABLE IF NOT EXISTS event_payment_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_booking_id uuid NOT NULL REFERENCES event_bookings(id) ON DELETE CASCADE,
  installment_number integer NOT NULL,
  amount_cents integer NOT NULL,
  due_date date NOT NULL,

  -- Stripe
  stripe_payment_intent_id text,
  stripe_payment_method_id text,

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','failed','refunded')),
  paid_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_events_studio_status ON events(studio_id, status);
CREATE INDEX IF NOT EXISTS idx_event_bookings_event_status ON event_bookings(event_id, booking_status);
CREATE INDEX IF NOT EXISTS idx_event_payment_schedule_due ON event_payment_schedule(due_date, status);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_payment_schedule ENABLE ROW LEVEL SECURITY;

-- events: public published events readable by anyone
CREATE POLICY events_public_read ON events
  FOR SELECT USING (is_public = true AND status = 'published');

-- events: studio members can read all events for their studio
CREATE POLICY events_studio_read ON events
  FOR SELECT USING (
    studio_id IN (SELECT studio_id FROM profiles WHERE id = auth.uid())
  );

-- events: owner/manager full access
CREATE POLICY events_owner_manage ON events
  FOR ALL USING (
    studio_id IN (
      SELECT studio_id FROM profiles
      WHERE id = auth.uid() AND role IN ('owner','manager')
    )
  );

-- event_options: inherit from events
CREATE POLICY event_options_read ON event_options
  FOR SELECT USING (
    event_id IN (SELECT id FROM events)
  );

CREATE POLICY event_options_manage ON event_options
  FOR ALL USING (
    event_id IN (
      SELECT id FROM events WHERE studio_id IN (
        SELECT studio_id FROM profiles
        WHERE id = auth.uid() AND role IN ('owner','manager')
      )
    )
  );

-- event_bookings: members read own bookings
CREATE POLICY event_bookings_member_read ON event_bookings
  FOR SELECT USING (
    member_id IN (SELECT id FROM members WHERE profile_id = auth.uid())
  );

-- event_bookings: owner/manager full access
CREATE POLICY event_bookings_owner_manage ON event_bookings
  FOR ALL USING (
    event_id IN (
      SELECT id FROM events WHERE studio_id IN (
        SELECT studio_id FROM profiles
        WHERE id = auth.uid() AND role IN ('owner','manager')
      )
    )
  );

-- event_payment_schedule: same as event_bookings
CREATE POLICY event_payments_member_read ON event_payment_schedule
  FOR SELECT USING (
    event_booking_id IN (
      SELECT id FROM event_bookings
      WHERE member_id IN (SELECT id FROM members WHERE profile_id = auth.uid())
    )
  );

CREATE POLICY event_payments_owner_manage ON event_payment_schedule
  FOR ALL USING (
    event_booking_id IN (
      SELECT id FROM event_bookings WHERE event_id IN (
        SELECT id FROM events WHERE studio_id IN (
          SELECT studio_id FROM profiles
          WHERE id = auth.uid() AND role IN ('owner','manager')
        )
      )
    )
  );

-- Service role bypass (for API routes)
CREATE POLICY events_service ON events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY event_options_service ON event_options FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY event_bookings_service ON event_bookings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY event_payments_service ON event_payment_schedule FOR ALL TO service_role USING (true) WITH CHECK (true);
