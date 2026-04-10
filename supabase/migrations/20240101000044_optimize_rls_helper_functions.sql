-- ============================================================
-- RLS パフォーマンス最適化: SECURITY DEFINER ヘルパー関数
--
-- 問題: instructor / manager の RLS ポリシーが毎回複数テーブルを
-- JOIN するサブクエリを実行し、パフォーマンスに影響する。
--
-- 解決: SECURITY DEFINER 関数でラップし、RLS 評価ループを回避。
-- Postgres は関数結果をクエリ内でキャッシュするため、
-- 同一リクエスト内の複数行評価でも1回しか実行されない。
-- ============================================================

-- 1. インストラクターの studio_id を取得するヘルパー
CREATE OR REPLACE FUNCTION public.get_instructor_studio_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT i.studio_id
  FROM public.instructors i
  WHERE i.profile_id = auth.uid()
  LIMIT 1;
$$;

-- 2. インストラクターの担当クラスIDリストを取得するヘルパー
CREATE OR REPLACE FUNCTION public.get_instructor_class_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT c.id
  FROM public.classes c
  JOIN public.instructors i ON i.id = c.instructor_id
  WHERE i.profile_id = auth.uid();
$$;

-- 3. マネージャーの studio_id を権限付きで取得するヘルパー
--    指定された権限カラムが true の場合のみ studio_id を返す。
--    汎用化のため、権限名でフィルタリングする別バージョンを用意。
CREATE OR REPLACE FUNCTION public.get_manager_studio_id_for_classes()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT m.studio_id
  FROM public.managers m
  WHERE m.profile_id = auth.uid()
    AND m.can_manage_classes = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_manager_studio_id_for_rooms()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT m.studio_id
  FROM public.managers m
  WHERE m.profile_id = auth.uid()
    AND m.can_manage_rooms = true
  LIMIT 1;
$$;

-- ============================================================
-- 4. Instructor RLS ポリシーを最適化（JOIN → 関数呼び出し）
-- ============================================================

-- class_sessions: インストラクターが自分のクラスセッションを閲覧
DROP POLICY IF EXISTS "Instructor can view own class sessions" ON class_sessions;
CREATE POLICY "Instructor can view own class sessions"
  ON class_sessions FOR SELECT
  USING (
    class_id IN (SELECT public.get_instructor_class_ids())
  );

-- bookings: インストラクターが自分のクラスの予約を閲覧
DROP POLICY IF EXISTS "Instructor can view own class bookings" ON bookings;
CREATE POLICY "Instructor can view own class bookings"
  ON bookings FOR SELECT
  USING (
    session_id IN (
      SELECT cs.id FROM class_sessions cs
      WHERE cs.class_id IN (SELECT public.get_instructor_class_ids())
    )
  );

-- drop_in_attendances: インストラクターが自分のクラスのドロップイン出席を閲覧
DROP POLICY IF EXISTS "Instructor can view own class drop-in attendances" ON drop_in_attendances;
CREATE POLICY "Instructor can view own class drop-in attendances"
  ON drop_in_attendances FOR SELECT
  USING (
    session_id IN (
      SELECT cs.id FROM class_sessions cs
      WHERE cs.class_id IN (SELECT public.get_instructor_class_ids())
    )
  );

-- ============================================================
-- 5. Manager RLS ポリシーを最適化（JOIN → 関数呼び出し）
-- ============================================================

-- classes: マネージャーがクラスを管理
DROP POLICY IF EXISTS "manager can manage classes" ON classes;
CREATE POLICY "manager can manage classes"
  ON public.classes FOR ALL
  USING (studio_id = public.get_manager_studio_id_for_classes())
  WITH CHECK (studio_id = public.get_manager_studio_id_for_classes());

-- class_sessions: マネージャーがセッションを管理
DROP POLICY IF EXISTS "manager can manage class sessions" ON class_sessions;
CREATE POLICY "manager can manage class sessions"
  ON public.class_sessions FOR ALL
  USING (studio_id = public.get_manager_studio_id_for_classes())
  WITH CHECK (studio_id = public.get_manager_studio_id_for_classes());

-- rooms: マネージャーがルームを管理
DROP POLICY IF EXISTS "manager can manage rooms" ON rooms;
CREATE POLICY "manager can manage rooms"
  ON public.rooms FOR ALL
  USING (studio_id = public.get_manager_studio_id_for_rooms())
  WITH CHECK (studio_id = public.get_manager_studio_id_for_rooms());
