-- ============================================
-- Phase 2a+2b: Instructor Fee Overrides & Fixed Amount Fees
-- ============================================

-- 1. Studios: fee type (percentage or fixed)
ALTER TABLE studios ADD COLUMN IF NOT EXISTS studio_fee_type text NOT NULL DEFAULT 'percentage';

-- 2. Instructor fee overrides table
CREATE TABLE IF NOT EXISTS instructor_fee_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  fee_type text NOT NULL DEFAULT 'percentage',  -- 'percentage' | 'fixed'
  fee_value decimal NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(studio_id, instructor_id),
  CONSTRAINT fee_value_check CHECK (
    (fee_type = 'percentage' AND fee_value >= 0 AND fee_value <= 100)
    OR (fee_type = 'fixed' AND fee_value >= 0)
  )
);

-- 3. instructor_earnings: fee_type and fee_source columns
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'instructor_earnings' AND column_name = 'fee_type'
  ) THEN
    ALTER TABLE instructor_earnings ADD COLUMN fee_type text NOT NULL DEFAULT 'percentage';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'instructor_earnings' AND column_name = 'fee_source'
  ) THEN
    ALTER TABLE instructor_earnings ADD COLUMN fee_source text NOT NULL DEFAULT 'studio_default';
  END IF;
END $$;

-- 4. RLS for instructor_fee_overrides
ALTER TABLE instructor_fee_overrides ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Owner can view fee overrides'
  ) THEN
    CREATE POLICY "Owner can view fee overrides"
      ON instructor_fee_overrides FOR SELECT
      USING (studio_id IN (
        SELECT studio_id FROM profiles WHERE id = auth.uid() AND role = 'owner'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Owner can manage fee overrides'
  ) THEN
    CREATE POLICY "Owner can manage fee overrides"
      ON instructor_fee_overrides FOR ALL
      USING (studio_id IN (
        SELECT studio_id FROM profiles WHERE id = auth.uid() AND role = 'owner'
      ))
      WITH CHECK (studio_id IN (
        SELECT studio_id FROM profiles WHERE id = auth.uid() AND role = 'owner'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage fee overrides'
  ) THEN
    CREATE POLICY "Service role can manage fee overrides"
      ON instructor_fee_overrides FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
