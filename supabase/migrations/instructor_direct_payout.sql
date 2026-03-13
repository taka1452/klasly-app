-- ============================================
-- Instructor Direct Payout - Phase 1
-- ============================================

-- Studios: payout model and studio fee
ALTER TABLE studios ADD COLUMN payout_model text NOT NULL DEFAULT 'studio';
ALTER TABLE studios ADD COLUMN studio_fee_percentage decimal NOT NULL DEFAULT 0;

-- Instructors: Stripe Connect fields
ALTER TABLE instructors ADD COLUMN stripe_account_id text;
ALTER TABLE instructors ADD COLUMN stripe_onboarding_complete boolean NOT NULL DEFAULT false;

-- Instructor earnings tracking table
CREATE TABLE instructor_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  session_id uuid REFERENCES class_sessions(id),
  booking_id uuid REFERENCES bookings(id),
  gross_amount integer NOT NULL,
  stripe_fee integer NOT NULL DEFAULT 0,
  platform_fee integer NOT NULL DEFAULT 0,
  studio_fee integer NOT NULL DEFAULT 0,
  instructor_payout integer NOT NULL,
  studio_fee_percentage decimal NOT NULL,
  stripe_payment_intent_id text,
  stripe_transfer_id text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE instructor_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view studio earnings"
  ON instructor_earnings FOR SELECT
  USING (studio_id IN (
    SELECT studio_id FROM profiles WHERE id = auth.uid() AND role = 'owner'
  ));

CREATE POLICY "Instructor can view own earnings"
  ON instructor_earnings FOR SELECT
  USING (instructor_id IN (
    SELECT id FROM instructors WHERE profile_id = auth.uid()
  ));

-- Service role can insert/update instructor_earnings
CREATE POLICY "Service role can manage earnings"
  ON instructor_earnings FOR ALL
  USING (true)
  WITH CHECK (true);
