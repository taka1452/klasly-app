-- ============================================
-- On-Demand Video Content
-- Instructors upload videos, members watch
-- ============================================

CREATE TABLE IF NOT EXISTS video_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES instructors(id) ON DELETE SET NULL,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration INT, -- seconds
  price INT NOT NULL DEFAULT 0, -- cents, 0 = free
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX video_content_studio_id ON video_content(studio_id);
CREATE INDEX video_content_instructor_id ON video_content(instructor_id);

CREATE TABLE IF NOT EXISTS video_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES video_content(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  payment_intent_id TEXT,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX video_purchases_unique ON video_purchases(video_id, member_id);

-- RLS
ALTER TABLE video_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON video_content FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON video_purchases FOR ALL TO service_role USING (true);

-- Published videos visible to studio members
CREATE POLICY "studio_members_select_published" ON video_content FOR SELECT USING (
  is_published = true AND studio_id IN (
    SELECT p.studio_id FROM profiles p WHERE p.id = auth.uid()
  )
);

-- Owner/instructor can manage their studio's videos
CREATE POLICY "staff_manage" ON video_content FOR ALL USING (
  studio_id IN (
    SELECT p.studio_id FROM profiles p
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'instructor', 'manager')
  )
);

-- Members see their purchases
CREATE POLICY "members_select_purchases" ON video_purchases FOR SELECT USING (
  member_id IN (
    SELECT m.id FROM members m
    JOIN profiles p ON p.id = m.profile_id
    WHERE p.id = auth.uid()
  )
);
