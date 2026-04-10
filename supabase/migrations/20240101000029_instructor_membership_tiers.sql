-- ============================================================
-- Phase 1 Step 3: Instructor Membership Tiers & Time Quotas
-- Tier-based monthly hour limits for instructor room bookings.
-- ============================================================

-- 1. Tier definitions (studio owner configures)
CREATE TABLE IF NOT EXISTS public.instructor_membership_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  name text NOT NULL,
  monthly_minutes int NOT NULL DEFAULT 0,   -- total monthly minutes (-1 = unlimited)
  monthly_price int NOT NULL DEFAULT 0,     -- price in cents (used in Step 4 billing)
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.instructor_membership_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_manage_tiers"
  ON public.instructor_membership_tiers FOR ALL
  USING (
    studio_id IN (
      SELECT studio_id FROM public.profiles WHERE id = auth.uid() AND role = 'owner'
    )
  )
  WITH CHECK (
    studio_id IN (
      SELECT studio_id FROM public.profiles WHERE id = auth.uid() AND role = 'owner'
    )
  );

CREATE POLICY "instructors_view_tiers"
  ON public.instructor_membership_tiers FOR SELECT
  USING (
    is_active = true
    AND studio_id IN (
      SELECT studio_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 2. Instructor membership (links instructor to a tier)
CREATE TABLE IF NOT EXISTS public.instructor_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  tier_id uuid NOT NULL REFERENCES public.instructor_membership_tiers(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active',  -- active, cancelled
  started_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(instructor_id)  -- one membership per instructor
);

ALTER TABLE public.instructor_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_manage_memberships"
  ON public.instructor_memberships FOR ALL
  USING (
    studio_id IN (
      SELECT studio_id FROM public.profiles WHERE id = auth.uid() AND role = 'owner'
    )
  )
  WITH CHECK (
    studio_id IN (
      SELECT studio_id FROM public.profiles WHERE id = auth.uid() AND role = 'owner'
    )
  );

CREATE POLICY "instructor_view_own_membership"
  ON public.instructor_memberships FOR SELECT
  USING (
    instructor_id IN (
      SELECT id FROM public.instructors WHERE profile_id = auth.uid()
    )
  );

-- 3. Function: get instructor's used minutes for a given month
-- Calculates from instructor_room_bookings (confirmed only)
CREATE OR REPLACE FUNCTION public.get_instructor_used_minutes(
  p_instructor_id uuid,
  p_year int,
  p_month int
)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    SUM(
      EXTRACT(EPOCH FROM (end_time - start_time))::int / 60
    ),
    0
  )::int
  FROM public.instructor_room_bookings
  WHERE instructor_id = p_instructor_id
    AND status = 'confirmed'
    AND EXTRACT(YEAR FROM booking_date) = p_year
    AND EXTRACT(MONTH FROM booking_date) = p_month;
$$;
