-- ============================================================
-- Collective Mode: Class-level pricing
-- Adds price_cents to classes table so instructors can set
-- per-class pricing in Collective Mode.
-- NULL = use studio product pricing (Studio Mode)
-- value = class-specific price in cents (Collective Mode)
-- ============================================================

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS price_cents integer;

-- Allow instructors to manage their own classes (for self-scheduling)
CREATE POLICY "instructor can manage own classes"
  ON public.classes FOR ALL
  USING (
    instructor_id IN (
      SELECT id FROM public.instructors
      WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    instructor_id IN (
      SELECT id FROM public.instructors
      WHERE profile_id = auth.uid()
    )
  );

-- Allow instructors to manage sessions for their own classes
CREATE POLICY "instructor can manage own class sessions"
  ON public.class_sessions FOR ALL
  USING (
    class_id IN (
      SELECT id FROM public.classes
      WHERE instructor_id IN (
        SELECT id FROM public.instructors
        WHERE profile_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    class_id IN (
      SELECT id FROM public.classes
      WHERE instructor_id IN (
        SELECT id FROM public.instructors
        WHERE profile_id = auth.uid()
      )
    )
  );
