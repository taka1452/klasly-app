-- =============================================
-- Link Click Tracking (UTM)
-- Sprint 2 - Task B
-- =============================================

CREATE TABLE IF NOT EXISTS link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  url text NOT NULL,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  user_agent text,
  ip_hash text,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE link_clicks ENABLE ROW LEVEL SECURITY;

-- Ownerのみ自スタジオのデータを閲覧可能
CREATE POLICY "Owner can view own link clicks"
  ON link_clicks FOR SELECT
  USING (studio_id IN (
    SELECT studio_id FROM profiles
    WHERE id = auth.uid() AND role IN ('owner', 'manager')
  ));

-- インデックス
CREATE INDEX IF NOT EXISTS idx_link_clicks_studio_created
  ON link_clicks(studio_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_link_clicks_utm_source
  ON link_clicks(studio_id, utm_source);
