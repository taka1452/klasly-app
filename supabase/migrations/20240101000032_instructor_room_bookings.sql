-- ============================================================
-- Phase 1 Step 2: Instructor Self-Scheduling (Room Bookings)
-- Instructors can book rooms + time slots from their portal.
-- ============================================================

-- 1. instructor_room_bookings テーブル
CREATE TABLE IF NOT EXISTS public.instructor_room_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  title text NOT NULL,
  booking_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  status text NOT NULL DEFAULT 'confirmed',
  is_public boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- 同じ部屋・日付・時間帯の重複を防止するための制約はアプリ層で管理
  -- （時間帯の重複チェックはCHECK制約では表現できないため）
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

ALTER TABLE public.instructor_room_bookings ENABLE ROW LEVEL SECURITY;

-- Instructor: 自分のブッキングをCRUD
CREATE POLICY "instructor_manage_own_room_bookings"
  ON public.instructor_room_bookings FOR ALL
  USING (
    instructor_id IN (
      SELECT id FROM public.instructors WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    instructor_id IN (
      SELECT id FROM public.instructors WHERE profile_id = auth.uid()
    )
  );

-- Owner: 全ブッキングを閲覧
CREATE POLICY "owner_view_all_room_bookings"
  ON public.instructor_room_bookings FOR SELECT
  USING (
    studio_id IN (
      SELECT studio_id FROM public.profiles WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- Owner: ブッキングをキャンセル（update status のみ）
CREATE POLICY "owner_manage_room_bookings"
  ON public.instructor_room_bookings FOR UPDATE
  USING (
    studio_id IN (
      SELECT studio_id FROM public.profiles WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- 2. 部屋の空き状況チェック用関数
-- 指定日・部屋で、指定時間帯に重複するブッキングがあるか確認
CREATE OR REPLACE FUNCTION public.check_room_availability(
  p_room_id uuid,
  p_booking_date date,
  p_start_time time,
  p_end_time time,
  p_exclude_booking_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.instructor_room_bookings
    WHERE room_id = p_room_id
      AND booking_date = p_booking_date
      AND status = 'confirmed'
      AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id)
      AND start_time < p_end_time
      AND end_time > p_start_time
  );
$$;
