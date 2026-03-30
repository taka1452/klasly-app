-- ============================================================
-- Appointments system: 1-on-1 booking
-- Tables: appointment_types, instructor_availability, appointments
-- ============================================================

-- 1. アポイントメントタイプ（サービスメニュー）
CREATE TABLE IF NOT EXISTS appointment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  duration_minutes integer NOT NULL DEFAULT 60,
  price_cents integer NOT NULL DEFAULT 0,
  buffer_minutes integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_types_studio ON appointment_types(studio_id);

-- 2. インストラクター空き時間（週間スケジュール）
CREATE TABLE IF NOT EXISTS instructor_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(instructor_id, day_of_week, start_time)
);

CREATE INDEX IF NOT EXISTS idx_instructor_availability_lookup
  ON instructor_availability(instructor_id, day_of_week);

-- 3. アポイントメント予約
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  appointment_type_id uuid NOT NULL REFERENCES appointment_types(id),
  instructor_id uuid NOT NULL REFERENCES instructors(id),
  member_id uuid NOT NULL REFERENCES members(id),
  appointment_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  status text NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed','completed','cancelled','no_show')),
  notes text,
  price_cents integer NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'credit'
    CHECK (payment_method IN ('credit','stripe','free')),
  stripe_payment_intent_id text,
  credit_deducted boolean NOT NULL DEFAULT false,
  soap_note_id uuid,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_studio_date
  ON appointments(studio_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_instructor_date
  ON appointments(instructor_id, appointment_date, status);
CREATE INDEX IF NOT EXISTS idx_appointments_member
  ON appointments(member_id, appointment_date);

-- Prevent double-booking the same instructor at the same time
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_no_double_booking
  ON appointments(instructor_id, appointment_date, start_time)
  WHERE status IN ('confirmed');

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE appointment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- appointment_types: スタジオメンバーが閲覧可、オーナー/マネージャーが管理
CREATE POLICY appointment_types_read ON appointment_types
  FOR SELECT USING (
    studio_id IN (
      SELECT studio_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY appointment_types_manage ON appointment_types
  FOR ALL USING (
    studio_id IN (
      SELECT studio_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

-- instructor_availability: スタジオメンバーが閲覧可、本人のみ管理
CREATE POLICY instructor_availability_read ON instructor_availability
  FOR SELECT USING (
    instructor_id IN (
      SELECT id FROM instructors WHERE studio_id IN (
        SELECT studio_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY instructor_availability_manage ON instructor_availability
  FOR ALL USING (
    instructor_id IN (
      SELECT id FROM instructors WHERE profile_id = auth.uid()
    )
  );

-- appointments: メンバーは自分、インストラクターは担当分、オーナーは全て
CREATE POLICY appointments_member_read ON appointments
  FOR SELECT USING (
    member_id IN (
      SELECT id FROM members WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY appointments_instructor_read ON appointments
  FOR SELECT USING (
    instructor_id IN (
      SELECT id FROM instructors WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY appointments_owner_manage ON appointments
  FOR ALL USING (
    studio_id IN (
      SELECT studio_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

-- Service role bypass
CREATE POLICY appointment_types_service ON appointment_types FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY instructor_availability_service ON instructor_availability FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY appointments_service ON appointments FOR ALL TO service_role USING (true) WITH CHECK (true);
