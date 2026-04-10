-- ============================================
-- Member Favorites
-- Members can favorite classes and instructors
-- ============================================

CREATE TABLE IF NOT EXISTS member_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  favorite_type TEXT NOT NULL CHECK (favorite_type IN ('class', 'instructor')),
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX member_favorites_unique ON member_favorites(member_id, favorite_type, target_id);
CREATE INDEX member_favorites_member_id ON member_favorites(member_id);

-- RLS
ALTER TABLE member_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON member_favorites FOR ALL TO service_role USING (true);

-- Members manage their own favorites
CREATE POLICY "members_select" ON member_favorites FOR SELECT USING (
  member_id IN (
    SELECT m.id FROM members m
    JOIN profiles p ON p.id = m.profile_id
    WHERE p.id = auth.uid()
  )
);

CREATE POLICY "members_insert" ON member_favorites FOR INSERT WITH CHECK (
  member_id IN (
    SELECT m.id FROM members m
    JOIN profiles p ON p.id = m.profile_id
    WHERE p.id = auth.uid()
  )
);

CREATE POLICY "members_delete" ON member_favorites FOR DELETE USING (
  member_id IN (
    SELECT m.id FROM members m
    JOIN profiles p ON p.id = m.profile_id
    WHERE p.id = auth.uid()
  )
);
