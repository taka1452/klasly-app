-- ============================================
-- Instructor Achievements & Trophies
-- Track teaching milestones and streaks
-- Feature flag: extension.instructor_achievements (default OFF)
-- ============================================

CREATE TABLE IF NOT EXISTS instructor_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  achievement_type TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB
);

-- One achievement per type per instructor
CREATE UNIQUE INDEX instructor_achievements_instructor_type ON instructor_achievements(instructor_id, achievement_type);
CREATE INDEX instructor_achievements_studio_id ON instructor_achievements(studio_id);

-- RLS
ALTER TABLE instructor_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON instructor_achievements FOR ALL TO service_role USING (true);

-- Instructors can view their own achievements
CREATE POLICY "instructors_select" ON instructor_achievements FOR SELECT USING (
  instructor_id IN (
    SELECT i.id FROM instructors i
    WHERE i.profile_id = auth.uid()
  )
);

-- Owners and managers can view all achievements in their studio
CREATE POLICY "owners_managers_select" ON instructor_achievements FOR SELECT USING (
  studio_id IN (
    SELECT p.studio_id FROM profiles p
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'manager')
  )
);
