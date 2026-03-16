-- ============================================
-- Phase 3: Class Fee Overrides, Fee Schedules,
--          Instructor Invites, Tax Report fields
-- ============================================

-- -----------------------------------------------
-- Phase 3a: class_fee_overrides
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_fee_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  fee_type text NOT NULL DEFAULT 'percentage',
  fee_value decimal NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(studio_id, class_id),
  CONSTRAINT class_fee_value_check CHECK (
    (fee_type = 'percentage' AND fee_value >= 0 AND fee_value <= 100)
    OR (fee_type = 'fixed' AND fee_value >= 0)
  )
);

ALTER TABLE public.class_fee_overrides ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Owners can view class fee overrides'
  ) THEN
    CREATE POLICY "Owners can view class fee overrides"
      ON public.class_fee_overrides FOR SELECT
      USING (
        studio_id IN (
          SELECT p.studio_id FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'owner'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Owners can manage class fee overrides'
  ) THEN
    CREATE POLICY "Owners can manage class fee overrides"
      ON public.class_fee_overrides FOR ALL
      USING (
        studio_id IN (
          SELECT p.studio_id FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'owner'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage class fee overrides'
  ) THEN
    CREATE POLICY "Service role can manage class fee overrides"
      ON public.class_fee_overrides FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- -----------------------------------------------
-- Phase 3b: fee_schedules
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.fee_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  name text NOT NULL,
  day_of_week integer[],        -- null = all days; e.g. {0,6} = Sun,Sat
  start_time time NOT NULL,
  end_time time NOT NULL,
  fee_type text NOT NULL DEFAULT 'percentage',
  fee_value decimal NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fee_schedule_value_check CHECK (
    (fee_type = 'percentage' AND fee_value >= 0 AND fee_value <= 100)
    OR (fee_type = 'fixed' AND fee_value >= 0)
  )
);

ALTER TABLE public.fee_schedules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Owners can view fee schedules'
  ) THEN
    CREATE POLICY "Owners can view fee schedules"
      ON public.fee_schedules FOR SELECT
      USING (
        studio_id IN (
          SELECT p.studio_id FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'owner'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Owners can manage fee schedules'
  ) THEN
    CREATE POLICY "Owners can manage fee schedules"
      ON public.fee_schedules FOR ALL
      USING (
        studio_id IN (
          SELECT p.studio_id FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'owner'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage fee schedules'
  ) THEN
    CREATE POLICY "Service role can manage fee schedules"
      ON public.fee_schedules FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- -----------------------------------------------
-- Phase 3c: instructor_invite_tokens
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.instructor_invite_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  invite_role text NOT NULL DEFAULT 'instructor', -- 'instructor' | 'manager'
  expires_at timestamptz NOT NULL,
  max_uses integer,
  use_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.instructor_invite_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Owners can view invite tokens'
  ) THEN
    CREATE POLICY "Owners can view invite tokens"
      ON public.instructor_invite_tokens FOR SELECT
      USING (
        studio_id IN (
          SELECT p.studio_id FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'owner'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Owners can manage invite tokens'
  ) THEN
    CREATE POLICY "Owners can manage invite tokens"
      ON public.instructor_invite_tokens FOR ALL
      USING (
        studio_id IN (
          SELECT p.studio_id FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'owner'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage invite tokens'
  ) THEN
    CREATE POLICY "Service role can manage invite tokens"
      ON public.instructor_invite_tokens FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Anyone can read token for validation (needed for join page)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read active invite tokens'
  ) THEN
    CREATE POLICY "Anyone can read active invite tokens"
      ON public.instructor_invite_tokens FOR SELECT
      USING (is_active = true AND expires_at > now());
  END IF;
END $$;
