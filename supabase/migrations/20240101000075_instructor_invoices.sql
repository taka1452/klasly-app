-- ============================================================
-- Monthly instructor invoices
-- ============================================================
-- Requested by Sunrise Yoga Studio (Jamie feedback 2026-04):
--   "Can we set up contracts by month and invoice them monthly?"
--
-- An instructor_invoice bundles a single instructor's monthly obligations
-- to the studio (tier subscription + overage + flat/per-class fees) into a
-- single document the studio can send, track, and mark paid.
--
-- Source-of-truth lines stay on their own tables:
--   * tier_charge_cents       — snapshot of instructor_membership_tiers monthly_price
--   * overage_charge_ids[]    — referenced instructor_overage_charges rows
--   * flat_fee_items (jsonb)  — snapshotted class_fee_overrides / fee_schedules
--   * session_count / total_minutes — audit numbers so instructor can reconcile
-- This keeps the invoice immutable after send while the underlying contracts
-- can change for the next period.
CREATE TABLE IF NOT EXISTS public.instructor_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,

  period_start date NOT NULL,
  period_end date NOT NULL,

  -- Snapshotted breakdown (cents)
  tier_name text,
  tier_charge_cents integer NOT NULL DEFAULT 0,
  overage_charge_cents integer NOT NULL DEFAULT 0,
  flat_fee_cents integer NOT NULL DEFAULT 0,
  adjustments_cents integer NOT NULL DEFAULT 0,       -- manual credit / one-off
  adjustments_note text,
  total_cents integer NOT NULL DEFAULT 0,

  -- Audit (for the PDF / email, purely informational)
  session_count integer NOT NULL DEFAULT 0,
  total_minutes integer NOT NULL DEFAULT 0,

  -- Linked records (so the invoice stays auditable even if the source
  -- contracts change later).
  overage_charge_ids uuid[] NOT NULL DEFAULT '{}',
  flat_fee_items jsonb NOT NULL DEFAULT '[]',

  status text NOT NULL DEFAULT 'draft',
    -- 'draft' | 'sent' | 'paid' | 'void'
  sent_at timestamptz,
  paid_at timestamptz,
  stripe_payment_intent_id text,
  notes text,

  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- One invoice per instructor per period (owner can re-generate by deleting
  -- the draft; don't want accidental duplicates).
  UNIQUE (studio_id, instructor_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_instructor_invoices_studio_period
  ON public.instructor_invoices(studio_id, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_instructor_invoices_instructor_period
  ON public.instructor_invoices(instructor_id, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_instructor_invoices_status
  ON public.instructor_invoices(studio_id, status);

ALTER TABLE public.instructor_invoices ENABLE ROW LEVEL SECURITY;

-- Owner / Manager (with can_view_payments) can manage invoices for their studio.
CREATE POLICY "owner_manager_manage_instructor_invoices"
  ON public.instructor_invoices FOR ALL
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

-- Instructors can view their own invoices.
CREATE POLICY "instructor_view_own_invoices"
  ON public.instructor_invoices FOR SELECT
  USING (
    instructor_id IN (
      SELECT id FROM public.instructors WHERE profile_id = auth.uid()
    )
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_instructor_invoices_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_instructor_invoices_updated_at ON public.instructor_invoices;
CREATE TRIGGER trg_instructor_invoices_updated_at
  BEFORE UPDATE ON public.instructor_invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_instructor_invoices_updated_at();
