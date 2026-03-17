-- =============================================
-- Announcements & Notification System
-- Sprint 2 - Task A
-- =============================================

-- アップデート通知の定義（Admin が作成）
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  target_roles text[] DEFAULT '{owner,instructor,member}',
  is_active boolean DEFAULT true,
  published_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- ユーザーごとの既読管理
CREATE TABLE IF NOT EXISTS announcement_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  UNIQUE(announcement_id, profile_id)
);

-- RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;

-- 全ユーザーがアクティブな通知を閲覧可能
CREATE POLICY "Anyone can view active announcements"
  ON announcements FOR SELECT
  USING (is_active = true);

-- ユーザーは自分の既読レコードのみ操作可能
CREATE POLICY "Users can manage own reads"
  ON announcement_reads FOR ALL
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
