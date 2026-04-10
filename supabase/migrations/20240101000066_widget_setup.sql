-- ============================================================
-- Widget Setup Migration
-- Creates widget_settings table, public RLS policies,
-- and get_session_availability function for the embed widget.
--
-- 注意: Supabase SQL Editor で実行する場合、
-- テーブル名に public. プレフィックスを明示的に指定しています。
-- ============================================================

-- 1. widget_settings テーブル
CREATE TABLE IF NOT EXISTS public.widget_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  theme_color TEXT NOT NULL DEFAULT 'green',
  allowed_origins TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(studio_id)
);

ALTER TABLE public.widget_settings ENABLE ROW LEVEL SECURITY;

-- Owner can manage their widget settings
CREATE POLICY "owner_manage_widget_settings"
  ON public.widget_settings
  FOR ALL
  USING (
    studio_id IN (
      SELECT p.studio_id FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'owner'
    )
  )
  WITH CHECK (
    studio_id IN (
      SELECT p.studio_id FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'owner'
    )
  );

-- Public can read enabled widget settings (for validation)
CREATE POLICY "public_read_enabled_widget_settings"
  ON public.widget_settings
  FOR SELECT
  USING (enabled = true);


-- 2. Public SELECT on classes (active only)
CREATE POLICY "public_read_active_classes"
  ON public.classes
  FOR SELECT
  USING (is_active = true);


-- 3. Public SELECT on class_sessions (future, non-cancelled only)
CREATE POLICY "public_read_future_class_sessions"
  ON public.class_sessions
  FOR SELECT
  USING (
    is_cancelled = false
    AND session_date >= CURRENT_DATE
  );


-- 4. get_session_availability function
-- Returns confirmed booking counts per session without exposing member data.
CREATE OR REPLACE FUNCTION public.get_session_availability(
  p_studio_id UUID,
  p_session_ids UUID[]
)
RETURNS TABLE(session_id UUID, confirmed_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT b.session_id, COUNT(*)::BIGINT AS confirmed_count
  FROM public.bookings b
  WHERE b.session_id = ANY(p_session_ids)
    AND b.studio_id = p_studio_id
    AND b.status = 'confirmed'
  GROUP BY b.session_id;
$$;
