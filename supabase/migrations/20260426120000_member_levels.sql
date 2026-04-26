-- ============================================
-- Member Levels (Bronze / Silver / Gold / Platinum / Diamond)
-- ============================================
--
-- Adds lifetime attendance tracking + rank progression to members.
-- Triggers keep lifetime_classes_attended in sync when bookings.attended
-- transitions to true or a drop_in_attendance is inserted, and auto-award
-- existing milestone achievements (first/5/10/25/50 classes) at the same
-- moment so the level system never feels empty.
--
-- Also creates member_achievements table (legacy file 20240101000037 was
-- never registered in remote migration history; this is the canonical
-- creation point going forward).

-- ── 0. member_achievements table (idempotent) ─────────────────────────
CREATE TABLE IF NOT EXISTS member_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  achievement_type TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS member_achievements_member_type ON member_achievements(member_id, achievement_type);
CREATE INDEX IF NOT EXISTS member_achievements_studio_id ON member_achievements(studio_id);

ALTER TABLE member_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON member_achievements;
CREATE POLICY "service_role_all" ON member_achievements FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "members_select" ON member_achievements;
CREATE POLICY "members_select" ON member_achievements FOR SELECT USING (
  member_id IN (
    SELECT m.id FROM members m
    JOIN profiles p ON p.id = m.profile_id
    WHERE p.id = auth.uid()
  )
);

DROP POLICY IF EXISTS "owners_select" ON member_achievements;
CREATE POLICY "owners_select" ON member_achievements FOR SELECT USING (
  studio_id IN (
    SELECT p.studio_id FROM profiles p
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'manager')
  )
);

-- ── 1. Level columns ─────────────────────────────────────────────────
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS lifetime_classes_attended INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_rank TEXT NOT NULL DEFAULT 'bronze',
  ADD COLUMN IF NOT EXISTS rank_celebrated_at TIMESTAMPTZ;

UPDATE members m
SET lifetime_classes_attended =
  COALESCE((SELECT COUNT(*) FROM bookings b
            WHERE b.member_id = m.id AND b.attended = true), 0)
  + COALESCE((SELECT COUNT(*) FROM drop_in_attendances d
              WHERE d.member_id = m.id), 0);

UPDATE members SET current_rank = CASE
  WHEN lifetime_classes_attended >= 300 THEN 'diamond'
  WHEN lifetime_classes_attended >= 100 THEN 'platinum'
  WHEN lifetime_classes_attended >= 30 THEN 'gold'
  WHEN lifetime_classes_attended >= 10 THEN 'silver'
  ELSE 'bronze'
END;

UPDATE members SET rank_celebrated_at = now() WHERE rank_celebrated_at IS NULL;

-- ── 2. Backfill milestone achievements ───────────────────────────────
INSERT INTO member_achievements (studio_id, member_id, achievement_type)
SELECT studio_id, id, 'first_class' FROM members WHERE lifetime_classes_attended >= 1
ON CONFLICT (member_id, achievement_type) DO NOTHING;

INSERT INTO member_achievements (studio_id, member_id, achievement_type)
SELECT studio_id, id, 'five_classes' FROM members WHERE lifetime_classes_attended >= 5
ON CONFLICT (member_id, achievement_type) DO NOTHING;

INSERT INTO member_achievements (studio_id, member_id, achievement_type)
SELECT studio_id, id, 'ten_classes' FROM members WHERE lifetime_classes_attended >= 10
ON CONFLICT (member_id, achievement_type) DO NOTHING;

INSERT INTO member_achievements (studio_id, member_id, achievement_type)
SELECT studio_id, id, 'twenty_five_classes' FROM members WHERE lifetime_classes_attended >= 25
ON CONFLICT (member_id, achievement_type) DO NOTHING;

INSERT INTO member_achievements (studio_id, member_id, achievement_type)
SELECT studio_id, id, 'fifty_classes' FROM members WHERE lifetime_classes_attended >= 50
ON CONFLICT (member_id, achievement_type) DO NOTHING;

-- ── 3. Auto-increment function ───────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_member_lifetime_classes(p_member_id UUID, p_studio_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_old_rank TEXT;
  v_new_rank TEXT;
BEGIN
  UPDATE members
  SET lifetime_classes_attended = lifetime_classes_attended + 1
  WHERE id = p_member_id
  RETURNING lifetime_classes_attended, current_rank INTO v_count, v_old_rank;

  IF v_count IS NULL THEN
    RETURN;
  END IF;

  v_new_rank := CASE
    WHEN v_count >= 300 THEN 'diamond'
    WHEN v_count >= 100 THEN 'platinum'
    WHEN v_count >= 30 THEN 'gold'
    WHEN v_count >= 10 THEN 'silver'
    ELSE 'bronze'
  END;

  IF v_new_rank <> v_old_rank THEN
    UPDATE members
    SET current_rank = v_new_rank,
        rank_celebrated_at = NULL
    WHERE id = p_member_id;
  END IF;

  IF v_count = 1 THEN
    INSERT INTO member_achievements (studio_id, member_id, achievement_type)
    VALUES (p_studio_id, p_member_id, 'first_class')
    ON CONFLICT (member_id, achievement_type) DO NOTHING;
  ELSIF v_count = 5 THEN
    INSERT INTO member_achievements (studio_id, member_id, achievement_type)
    VALUES (p_studio_id, p_member_id, 'five_classes')
    ON CONFLICT (member_id, achievement_type) DO NOTHING;
  ELSIF v_count = 10 THEN
    INSERT INTO member_achievements (studio_id, member_id, achievement_type)
    VALUES (p_studio_id, p_member_id, 'ten_classes')
    ON CONFLICT (member_id, achievement_type) DO NOTHING;
  ELSIF v_count = 25 THEN
    INSERT INTO member_achievements (studio_id, member_id, achievement_type)
    VALUES (p_studio_id, p_member_id, 'twenty_five_classes')
    ON CONFLICT (member_id, achievement_type) DO NOTHING;
  ELSIF v_count = 50 THEN
    INSERT INTO member_achievements (studio_id, member_id, achievement_type)
    VALUES (p_studio_id, p_member_id, 'fifty_classes')
    ON CONFLICT (member_id, achievement_type) DO NOTHING;
  END IF;
END;
$$;

-- ── 4. Triggers ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_bookings_attended_lifetime()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.attended = true AND (OLD.attended IS NULL OR OLD.attended = false) THEN
    PERFORM increment_member_lifetime_classes(NEW.member_id, NEW.studio_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_attended_lifetime ON bookings;
CREATE TRIGGER bookings_attended_lifetime
AFTER UPDATE OF attended ON bookings
FOR EACH ROW EXECUTE FUNCTION trg_bookings_attended_lifetime();

CREATE OR REPLACE FUNCTION trg_drop_in_lifetime()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM increment_member_lifetime_classes(NEW.member_id, NEW.studio_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS drop_in_lifetime ON drop_in_attendances;
CREATE TRIGGER drop_in_lifetime
AFTER INSERT ON drop_in_attendances
FOR EACH ROW EXECUTE FUNCTION trg_drop_in_lifetime();
