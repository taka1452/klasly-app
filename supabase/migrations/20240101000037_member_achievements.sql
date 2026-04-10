-- ============================================
-- Member Achievements & Badges
-- Track attendance milestones and streaks
-- ============================================

CREATE TABLE IF NOT EXISTS member_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  achievement_type TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB
);

-- One achievement per type per member
CREATE UNIQUE INDEX member_achievements_member_type ON member_achievements(member_id, achievement_type);
CREATE INDEX member_achievements_studio_id ON member_achievements(studio_id);

-- RLS
ALTER TABLE member_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON member_achievements FOR ALL TO service_role USING (true);

-- Members can view their own achievements
CREATE POLICY "members_select" ON member_achievements FOR SELECT USING (
  member_id IN (
    SELECT m.id FROM members m
    JOIN profiles p ON p.id = m.profile_id
    WHERE p.id = auth.uid()
  )
);

-- Owners can view all achievements in their studio
CREATE POLICY "owners_select" ON member_achievements FOR SELECT USING (
  studio_id IN (
    SELECT p.studio_id FROM profiles p
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'manager')
  )
);
