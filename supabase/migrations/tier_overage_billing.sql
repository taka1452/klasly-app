-- ============================================================
-- Tier Overage Billing
-- Adds overage rate and policy to tiers, and overage charge records.
-- ============================================================

-- 1. Add overage columns to instructor_membership_tiers
ALTER TABLE public.instructor_membership_tiers
  ADD COLUMN IF NOT EXISTS overage_rate_cents integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS allow_overage boolean NOT NULL DEFAULT true;

-- 2. Overage charge records table
CREATE TABLE IF NOT EXISTS public.instructor_overage_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  tier_name text NOT NULL,
  included_minutes integer NOT NULL,
  used_minutes integer NOT NULL,
  overage_minutes integer NOT NULL,
  overage_rate_cents integer NOT NULL,
  total_charge_cents integer NOT NULL,
  stripe_payment_intent_id text,
  status text NOT NULL DEFAULT 'pending',
  waived_by uuid REFERENCES public.profiles(id),
  waived_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.instructor_overage_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_manager_manage_overage_charges"
  ON public.instructor_overage_charges FOR ALL
  USING (
    studio_id IN (
      SELECT studio_id FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    studio_id IN (
      SELECT studio_id FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

CREATE POLICY "instructor_view_own_overage_charges"
  ON public.instructor_overage_charges FOR SELECT
  USING (
    instructor_id IN (
      SELECT id FROM public.instructors WHERE profile_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_overage_charges_instructor_period
  ON public.instructor_overage_charges(instructor_id, period_start);

CREATE INDEX IF NOT EXISTS idx_overage_charges_studio_status
  ON public.instructor_overage_charges(studio_id, status);
