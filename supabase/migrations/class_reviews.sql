-- ============================================
-- Class Reviews / Ratings
-- Members can rate classes after attending
-- ============================================

CREATE TABLE IF NOT EXISTS class_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES instructors(id) ON DELETE SET NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One review per member per session
CREATE UNIQUE INDEX class_reviews_member_session ON class_reviews(member_id, session_id);

-- For aggregate queries
CREATE INDEX class_reviews_class_id ON class_reviews(class_id);
CREATE INDEX class_reviews_instructor_id ON class_reviews(instructor_id);
CREATE INDEX class_reviews_studio_id ON class_reviews(studio_id);

-- RLS
ALTER TABLE class_reviews ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY "service_role_all" ON class_reviews FOR ALL TO service_role USING (true);

-- Members can view reviews in their studio
CREATE POLICY "members_select" ON class_reviews FOR SELECT USING (
  studio_id IN (
    SELECT m.studio_id FROM members m
    JOIN profiles p ON p.id = m.profile_id
    WHERE p.id = auth.uid()
  )
);

-- Members can insert their own review
CREATE POLICY "members_insert" ON class_reviews FOR INSERT WITH CHECK (
  member_id IN (
    SELECT m.id FROM members m
    JOIN profiles p ON p.id = m.profile_id
    WHERE p.id = auth.uid()
  )
);

-- Members can delete their own review
CREATE POLICY "members_delete" ON class_reviews FOR DELETE USING (
  member_id IN (
    SELECT m.id FROM members m
    JOIN profiles p ON p.id = m.profile_id
    WHERE p.id = auth.uid()
  )
);

-- Owners/managers can view all reviews in their studio
CREATE POLICY "owners_select" ON class_reviews FOR SELECT USING (
  studio_id IN (
    SELECT p.studio_id FROM profiles p
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'manager')
  )
);

-- Instructors can view reviews for their studio
CREATE POLICY "instructors_select" ON class_reviews FOR SELECT USING (
  studio_id IN (
    SELECT i.studio_id FROM instructors i
    JOIN profiles p ON p.id = i.profile_id
    WHERE p.id = auth.uid()
  )
);
