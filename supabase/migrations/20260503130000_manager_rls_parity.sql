-- ============================================================
-- Manager RLS parity: give managers access to tables that
-- currently only have owner-only policies.
-- Uses SECURITY DEFINER helpers (querying `managers` table,
-- NOT `profiles`) to avoid RLS recursion on profiles.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Helper functions (same pattern as existing get_manager_studio_id_for_classes)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_manager_studio_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.studio_id FROM public.managers m
  WHERE m.profile_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_manager_studio_id_for_members()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.studio_id FROM public.managers m
  WHERE m.profile_id = auth.uid()
    AND m.can_manage_members = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_manager_studio_id_for_bookings()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.studio_id FROM public.managers m
  WHERE m.profile_id = auth.uid()
    AND m.can_manage_bookings = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_manager_studio_id_for_instructors()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.studio_id FROM public.managers m
  WHERE m.profile_id = auth.uid()
    AND m.can_manage_instructors = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_manager_studio_id_for_payments()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.studio_id FROM public.managers m
  WHERE m.profile_id = auth.uid()
    AND m.can_view_payments = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_manager_studio_id_for_messages()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.studio_id FROM public.managers m
  WHERE m.profile_id = auth.uid()
    AND m.can_send_messages = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_manager_studio_id_for_settings()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.studio_id FROM public.managers m
  WHERE m.profile_id = auth.uid()
    AND m.can_manage_settings = true
  LIMIT 1;
$$;

-- ────────────────────────────────────────────────────────────
-- 2. profiles — manager can read all studio profiles (needed for app to function)
-- ────────────────────────────────────────────────────────────
CREATE POLICY "manager can view studio profiles"
  ON profiles FOR SELECT
  USING (studio_id = get_manager_studio_id());

-- ────────────────────────────────────────────────────────────
-- 3. studios — manager can read own studio
-- ────────────────────────────────────────────────────────────
CREATE POLICY "manager can view own studio"
  ON studios FOR SELECT
  USING (id = get_manager_studio_id());

CREATE POLICY "manager can update own studio"
  ON studios FOR UPDATE
  USING (id = get_manager_studio_id_for_settings());

-- ────────────────────────────────────────────────────────────
-- 4. members — gated by can_manage_members
-- ────────────────────────────────────────────────────────────
CREATE POLICY "manager can view members"
  ON members FOR SELECT
  USING (studio_id = get_manager_studio_id_for_members());

CREATE POLICY "manager can update members"
  ON members FOR UPDATE
  USING (studio_id = get_manager_studio_id_for_members());

CREATE POLICY "manager can delete members"
  ON members FOR DELETE
  USING (studio_id = get_manager_studio_id_for_members());

-- ────────────────────────────────────────────────────────────
-- 5. bookings — gated by can_manage_bookings
-- ────────────────────────────────────────────────────────────
CREATE POLICY "manager can view bookings"
  ON bookings FOR SELECT
  USING (studio_id = get_manager_studio_id_for_bookings());

-- ────────────────────────────────────────────────────────────
-- 6. payments — gated by can_view_payments (read-only)
-- ────────────────────────────────────────────────────────────
CREATE POLICY "manager can view payments"
  ON payments FOR SELECT
  USING (studio_id = get_manager_studio_id_for_payments());

-- ────────────────────────────────────────────────────────────
-- 7. instructors — gated by can_manage_instructors
-- ────────────────────────────────────────────────────────────
CREATE POLICY "manager can view instructors"
  ON instructors FOR SELECT
  USING (studio_id = get_manager_studio_id_for_instructors());

CREATE POLICY "manager can update instructors"
  ON instructors FOR UPDATE
  USING (studio_id = get_manager_studio_id_for_instructors());

-- ────────────────────────────────────────────────────────────
-- 8. messages — gated by can_send_messages
-- ────────────────────────────────────────────────────────────
CREATE POLICY "manager can view messages"
  ON messages FOR SELECT
  USING (studio_id = get_manager_studio_id_for_messages());

-- ────────────────────────────────────────────────────────────
-- 9. instructor_earnings — gated by can_view_payments (read-only)
-- ────────────────────────────────────────────────────────────
CREATE POLICY "manager can view earnings"
  ON instructor_earnings FOR SELECT
  USING (studio_id = get_manager_studio_id_for_payments());

-- ────────────────────────────────────────────────────────────
-- 10. instructor_fee_overrides — gated by can_manage_contracts_tiers
--     (read via can_view_payments, write via can_manage_contracts_tiers)
-- ────────────────────────────────────────────────────────────
CREATE POLICY "manager can view fee overrides"
  ON instructor_fee_overrides FOR SELECT
  USING (studio_id = get_manager_studio_id_for_payments());

-- ────────────────────────────────────────────────────────────
-- 11. drop_in_attendances — gated by can_manage_bookings
-- ────────────────────────────────────────────────────────────
CREATE POLICY "manager can manage drop-in attendances"
  ON drop_in_attendances FOR ALL
  USING (studio_id = get_manager_studio_id_for_bookings());

-- ────────────────────────────────────────────────────────────
-- 12. waiver_signatures — gated by can_manage_members (read-only)
-- ────────────────────────────────────────────────────────────
CREATE POLICY "manager can view waiver signatures"
  ON waiver_signatures FOR SELECT
  USING (studio_id = get_manager_studio_id_for_members());

-- ────────────────────────────────────────────────────────────
-- 13. waiver_templates — gated by can_manage_settings
-- ────────────────────────────────────────────────────────────
CREATE POLICY "manager can manage waiver templates"
  ON waiver_templates FOR ALL
  USING (studio_id = get_manager_studio_id_for_settings());
