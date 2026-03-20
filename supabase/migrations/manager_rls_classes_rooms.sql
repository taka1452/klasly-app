-- ============================================================
-- Manager RLS: Classes, Class Sessions, and Rooms
-- Allows managers with appropriate permissions to manage
-- classes, class_sessions, and rooms in their studio.
-- ============================================================

-- 1. Managers with can_manage_classes can manage classes
CREATE POLICY "manager can manage classes"
  ON public.classes FOR ALL
  USING (
    studio_id IN (
      SELECT m.studio_id FROM public.managers m
      JOIN public.profiles p ON p.id = m.profile_id
      WHERE m.profile_id = auth.uid()
        AND p.role = 'manager'
        AND m.can_manage_classes = true
    )
  )
  WITH CHECK (
    studio_id IN (
      SELECT m.studio_id FROM public.managers m
      JOIN public.profiles p ON p.id = m.profile_id
      WHERE m.profile_id = auth.uid()
        AND p.role = 'manager'
        AND m.can_manage_classes = true
    )
  );

-- 2. Managers with can_manage_classes can manage class_sessions
CREATE POLICY "manager can manage class sessions"
  ON public.class_sessions FOR ALL
  USING (
    studio_id IN (
      SELECT m.studio_id FROM public.managers m
      JOIN public.profiles p ON p.id = m.profile_id
      WHERE m.profile_id = auth.uid()
        AND p.role = 'manager'
        AND m.can_manage_classes = true
    )
  )
  WITH CHECK (
    studio_id IN (
      SELECT m.studio_id FROM public.managers m
      JOIN public.profiles p ON p.id = m.profile_id
      WHERE m.profile_id = auth.uid()
        AND p.role = 'manager'
        AND m.can_manage_classes = true
    )
  );

-- 3. Managers with can_manage_rooms can manage rooms
CREATE POLICY "manager can manage rooms"
  ON public.rooms FOR ALL
  USING (
    studio_id IN (
      SELECT m.studio_id FROM public.managers m
      JOIN public.profiles p ON p.id = m.profile_id
      WHERE m.profile_id = auth.uid()
        AND p.role = 'manager'
        AND m.can_manage_rooms = true
    )
  )
  WITH CHECK (
    studio_id IN (
      SELECT m.studio_id FROM public.managers m
      JOIN public.profiles p ON p.id = m.profile_id
      WHERE m.profile_id = auth.uid()
        AND p.role = 'manager'
        AND m.can_manage_rooms = true
    )
  );
