-- ============================================
-- Class + Room Unification Migration
-- クラステンプレート + セッション統合
-- ============================================

-- ============================================
-- 1. class_templates テーブル（新規）
-- ============================================
CREATE TABLE IF NOT EXISTS class_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  instructor_id uuid REFERENCES instructors(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  duration_minutes integer NOT NULL DEFAULT 60,
  capacity integer NOT NULL DEFAULT 15,
  price_cents integer,
  location text,
  class_type text NOT NULL DEFAULT 'in_person',
  online_link text,
  is_active boolean NOT NULL DEFAULT true,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),

  CONSTRAINT valid_class_type CHECK (class_type IN ('in_person', 'online', 'hybrid'))
);

ALTER TABLE class_templates ENABLE ROW LEVEL SECURITY;

-- Owner: full access
CREATE POLICY "owner_manage_class_templates"
  ON class_templates FOR ALL
  USING (
    studio_id IN (
      SELECT studio_id FROM profiles
      WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- Manager with can_manage_classes: full access
CREATE POLICY "manager_manage_class_templates"
  ON class_templates FOR ALL
  USING (
    studio_id IN (
      SELECT m.studio_id FROM managers m
      JOIN profiles p ON p.id = m.profile_id
      WHERE m.profile_id = auth.uid()
        AND p.role = 'manager'
        AND m.can_manage_classes = true
    )
  );

-- Instructor: view all in own studio, manage own templates
CREATE POLICY "instructor_view_class_templates"
  ON class_templates FOR SELECT
  USING (
    studio_id IN (
      SELECT studio_id FROM instructors
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "instructor_manage_own_class_templates"
  ON class_templates FOR ALL
  USING (
    instructor_id IN (
      SELECT id FROM instructors
      WHERE profile_id = auth.uid()
    )
  );

-- Member: view active, public templates in own studio
CREATE POLICY "member_view_class_templates"
  ON class_templates FOR SELECT
  USING (
    is_active = true AND is_public = true
    AND studio_id IN (
      SELECT studio_id FROM profiles
      WHERE id = auth.uid() AND role = 'member'
    )
  );

CREATE INDEX IF NOT EXISTS idx_class_templates_studio
  ON class_templates(studio_id);
CREATE INDEX IF NOT EXISTS idx_class_templates_instructor
  ON class_templates(instructor_id);

-- ============================================
-- 2. class_sessions テーブル拡張
-- ============================================

-- 新カラム追加
ALTER TABLE class_sessions
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES class_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES rooms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS instructor_id uuid REFERENCES instructors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS end_time time,
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'class',
  ADD COLUMN IF NOT EXISTS price_cents integer,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS recurrence_group_id uuid,
  ADD COLUMN IF NOT EXISTS recurrence_rule text;

-- session_type 制約
ALTER TABLE class_sessions
  ADD CONSTRAINT valid_session_type
    CHECK (session_type IN ('class', 'room_only'));

-- recurrence_rule 制約
ALTER TABLE class_sessions
  ADD CONSTRAINT valid_recurrence_rule
    CHECK (recurrence_rule IS NULL OR recurrence_rule IN ('weekly'));

-- class_id をNULL許可（room_only セッション用）
ALTER TABLE class_sessions
  ALTER COLUMN class_id DROP NOT NULL;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_sessions_template
  ON class_sessions(template_id);
CREATE INDEX IF NOT EXISTS idx_sessions_room
  ON class_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_sessions_instructor
  ON class_sessions(instructor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_recurrence_group
  ON class_sessions(recurrence_group_id);
CREATE INDEX IF NOT EXISTS idx_sessions_type_date
  ON class_sessions(session_type, session_date);

-- ============================================
-- 3. RLS: class_sessions に instructor/room_only ポリシー追加
-- ============================================

-- Instructor: 自分のroom_onlyセッションのINSERT/UPDATE/DELETE
CREATE POLICY "instructor_manage_own_sessions"
  ON class_sessions FOR ALL
  USING (
    instructor_id IN (
      SELECT id FROM instructors
      WHERE profile_id = auth.uid()
    )
  );

-- ============================================
-- 4. データ移行: classes → class_templates
-- ============================================

-- 4a. 既存classesからclass_templatesを作成
INSERT INTO class_templates (
  id, studio_id, instructor_id, name, description,
  duration_minutes, capacity, price_cents, location,
  class_type, online_link, is_active, is_public, created_at
)
SELECT
  id,  -- 同じIDを使うことでマッピングが不要
  studio_id,
  instructor_id,
  name,
  description,
  duration_minutes,
  capacity,
  price_cents,
  location,
  CASE
    WHEN is_online = true THEN 'online'
    ELSE 'in_person'
  END,
  online_link,
  is_active,
  is_public,
  created_at
FROM classes
ON CONFLICT (id) DO NOTHING;

-- 4b. 既存class_sessionsにtemplate_id, room_id, instructor_id, end_time, duration_minutesを埋める
UPDATE class_sessions cs SET
  template_id = c.id,  -- class_idと同じ（templatesに同IDでコピーしたため）
  room_id = c.room_id,
  instructor_id = c.instructor_id,
  end_time = (cs.start_time::time + (c.duration_minutes || ' minutes')::interval)::time,
  duration_minutes = c.duration_minutes
FROM classes c
WHERE cs.class_id = c.id
  AND cs.template_id IS NULL;

-- ============================================
-- 5. データ移行: instructor_room_bookings → class_sessions
-- ============================================

INSERT INTO class_sessions (
  id, studio_id, class_id, template_id, room_id, instructor_id,
  session_date, start_time, end_time, duration_minutes,
  capacity, is_cancelled, is_public, title,
  session_type, recurrence_group_id, recurrence_rule,
  created_at
)
SELECT
  id,
  studio_id,
  NULL,           -- class_id = NULL (部屋のみ)
  NULL,           -- template_id = NULL (部屋のみ)
  room_id,
  instructor_id,
  booking_date,
  start_time,
  end_time,
  EXTRACT(EPOCH FROM (end_time::time - start_time::time))::integer / 60,
  0,              -- capacity = 0 (部屋のみ予約なのでメンバー予約なし)
  CASE WHEN status = 'cancelled' THEN true ELSE false END,
  is_public,
  title,
  'room_only',
  recurrence_group_id,
  CASE WHEN recurrence_group_id IS NOT NULL THEN 'weekly' ELSE NULL END,
  created_at
FROM instructor_room_bookings
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 6. check_room_availability 関数を更新
--    class_sessions テーブル統合版
-- ============================================

CREATE OR REPLACE FUNCTION check_room_availability(
  p_room_id uuid,
  p_booking_date date,
  p_start_time time,
  p_end_time time,
  p_exclude_session_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM class_sessions
    WHERE room_id = p_room_id
      AND session_date = p_booking_date
      AND is_cancelled = false
      AND start_time < p_end_time
      AND end_time > p_start_time
      AND (p_exclude_session_id IS NULL OR id != p_exclude_session_id)
  );
END;
$$;

-- ============================================
-- 7. get_instructor_used_minutes 関数を更新
--    class_sessions ベースで集計
-- ============================================

CREATE OR REPLACE FUNCTION get_instructor_used_minutes(
  p_instructor_id uuid,
  p_studio_id uuid,
  p_month_start date,
  p_month_end date
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  total integer;
BEGIN
  SELECT COALESCE(SUM(
    CASE
      WHEN duration_minutes IS NOT NULL THEN duration_minutes
      WHEN end_time IS NOT NULL AND start_time IS NOT NULL THEN
        EXTRACT(EPOCH FROM (end_time::time - start_time::time))::integer / 60
      ELSE 0
    END
  ), 0)
  INTO total
  FROM class_sessions
  WHERE instructor_id = p_instructor_id
    AND studio_id = p_studio_id
    AND room_id IS NOT NULL
    AND is_cancelled = false
    AND session_date >= p_month_start
    AND session_date <= p_month_end;

  RETURN total;
END;
$$;
