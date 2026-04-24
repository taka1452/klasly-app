-- ============================================================
-- Saved reports for the analytics report builder
-- ============================================================
-- Requested by Sunrise Yoga Studio (Jamie feedback 2026-04):
--   "Will we be able to create and save reports for future use?"
--
-- A saved report is a named, reusable query definition: pick a report_type
-- (which determines the data source + chart), set filters (date range,
-- instructor, class, grouping), and save it. Anyone in the studio with the
-- Analytics permission can re-run it anytime.
CREATE TABLE IF NOT EXISTS public.saved_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  report_type text NOT NULL,
    -- 'revenue_over_time' | 'class_attendance' | 'instructor_payouts'
    -- | 'member_growth' | 'drop_in_counts' | 'room_utilization'
  filters jsonb NOT NULL DEFAULT '{}',
    -- JSON: { date_range: 'last_7_days' | 'last_30_days' | 'last_90_days'
    --       | 'this_month' | 'last_month' | 'custom',
    --        date_from?, date_to?, instructor_id?, class_template_id?,
    --        group_by?: 'day' | 'week' | 'month' }
  is_favorite boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_reports_studio
  ON public.saved_reports(studio_id, created_at DESC);

ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "studio_members_manage_saved_reports"
  ON public.saved_reports FOR ALL
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

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_saved_reports_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_saved_reports_updated_at ON public.saved_reports;
CREATE TRIGGER trg_saved_reports_updated_at
  BEFORE UPDATE ON public.saved_reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_saved_reports_updated_at();
