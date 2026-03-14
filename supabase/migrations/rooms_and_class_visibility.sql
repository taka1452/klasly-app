-- ============================================================
-- Phase 1 Step 1: Rooms & Class Visibility
-- 1. rooms table (resource/room management)
-- 2. classes.room_id FK
-- 3. classes.is_public flag
-- ============================================================

-- 1. rooms テーブル
CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  capacity int,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Owner: full management
CREATE POLICY "owner can manage rooms"
  ON public.rooms FOR ALL
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

-- Instructor + Member: can view active rooms in their studio
CREATE POLICY "studio users can view rooms"
  ON public.rooms FOR SELECT
  USING (
    is_active = true
    AND studio_id IN (
      SELECT studio_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 2. classes に room_id カラムを追加
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL;

-- 3. classes に is_public フラグを追加（デフォルト true = 公開）
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;
