-- ============================================
-- Member Streaks · Class Diversity · Comeback nudge
-- ============================================
--
-- Adds 3 engagement features layered on top of member_levels:
--
--  A. Weekly attendance streak — kept fresh by attendance trigger,
--     decayed by daily cron when a week is missed.
--  B. Class diversity badges — first 5 instructors / first 5 class
--     types / morning+afternoon+evening explorer.
--  C. Comeback window — comeback_card_until is set by daily cron when
--     a member has been idle ≥21 days; UI shows a welcome-back card
--     for 7 days, attendance trigger clears it on return.

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS current_streak_weeks INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak_weeks INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attended_week DATE,
  ADD COLUMN IF NOT EXISTS comeback_card_until TIMESTAMPTZ;

-- ── Backfill streak fields from existing attendance history ──────────
-- Compute last_attended_week and current streak (consecutive weeks
-- ending at max attended week, including current/last week tolerance).
WITH attended AS (
  SELECT m.id AS member_id,
         (date_trunc('week', b.created_at)::date) AS week
  FROM members m
  JOIN bookings b ON b.member_id = m.id AND b.attended = true
  UNION
  SELECT m.id, (date_trunc('week', d.attended_at)::date)
  FROM members m
  JOIN drop_in_attendances d ON d.member_id = m.id
),
last_week AS (
  SELECT member_id, max(week) AS lw FROM attended GROUP BY member_id
),
weeks_ranked AS (
  SELECT a.member_id, a.week,
         row_number() OVER (PARTITION BY a.member_id ORDER BY a.week DESC) AS rn
  FROM attended a
),
streaks AS (
  SELECT wr.member_id,
         count(*) AS streak
  FROM weeks_ranked wr
  JOIN last_week lw ON lw.member_id = wr.member_id
  WHERE wr.week = lw.lw - ((wr.rn - 1) * INTERVAL '7 day')
  GROUP BY wr.member_id
)
UPDATE members m SET
  last_attended_week = lw.lw,
  current_streak_weeks = COALESCE(s.streak, 0),
  longest_streak_weeks = COALESCE(s.streak, 0)
FROM last_week lw
LEFT JOIN streaks s ON s.member_id = lw.member_id
WHERE m.id = lw.member_id;

-- ── Replace increment function: now also bumps streak + checks
-- diversity badges + clears comeback window on attendance. ───────────
CREATE OR REPLACE FUNCTION increment_member_lifetime_classes(p_member_id UUID, p_studio_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_old_rank TEXT;
  v_new_rank TEXT;
  v_this_week DATE;
  v_last_week DATE;
  v_streak INT;
  v_longest INT;
  v_distinct_instructors INT;
  v_distinct_types INT;
  v_morning INT;
  v_afternoon INT;
  v_evening INT;
BEGIN
  v_this_week := date_trunc('week', now())::date;

  UPDATE members
  SET lifetime_classes_attended = lifetime_classes_attended + 1,
      comeback_card_until = NULL
  WHERE id = p_member_id
  RETURNING lifetime_classes_attended, current_rank, last_attended_week,
            current_streak_weeks, longest_streak_weeks
  INTO v_count, v_old_rank, v_last_week, v_streak, v_longest;

  IF v_count IS NULL THEN
    RETURN;
  END IF;

  -- Streak update: same week → no change. Exactly previous week → +1.
  -- Otherwise → reset to 1.
  IF v_last_week IS NULL THEN
    v_streak := 1;
  ELSIF v_last_week = v_this_week THEN
    -- already counted this week
    NULL;
  ELSIF v_last_week = v_this_week - INTERVAL '7 day' THEN
    v_streak := v_streak + 1;
  ELSE
    v_streak := 1;
  END IF;
  IF v_streak > v_longest THEN
    v_longest := v_streak;
  END IF;

  UPDATE members
  SET last_attended_week = v_this_week,
      current_streak_weeks = v_streak,
      longest_streak_weeks = v_longest
  WHERE id = p_member_id;

  -- Rank progression
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

  -- Milestone achievements
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

  -- Streak achievements (week-based, mapped onto existing
  -- streak_7_days / streak_30_days / streak_90_days names)
  IF v_streak >= 1 THEN
    INSERT INTO member_achievements (studio_id, member_id, achievement_type)
    VALUES (p_studio_id, p_member_id, 'streak_7_days')
    ON CONFLICT (member_id, achievement_type) DO NOTHING;
  END IF;
  IF v_streak >= 4 THEN
    INSERT INTO member_achievements (studio_id, member_id, achievement_type)
    VALUES (p_studio_id, p_member_id, 'streak_30_days')
    ON CONFLICT (member_id, achievement_type) DO NOTHING;
  END IF;
  IF v_streak >= 13 THEN
    INSERT INTO member_achievements (studio_id, member_id, achievement_type)
    VALUES (p_studio_id, p_member_id, 'streak_90_days')
    ON CONFLICT (member_id, achievement_type) DO NOTHING;
  END IF;

  -- Diversity badges: unlocked once, no need to re-check after granted.
  -- Cheap to compute — distinct counts on a single member's history.
  IF NOT EXISTS (
    SELECT 1 FROM member_achievements
    WHERE member_id = p_member_id AND achievement_type = 'five_instructors'
  ) THEN
    SELECT count(DISTINCT cs.instructor_id)
    INTO v_distinct_instructors
    FROM (
      SELECT b.session_id FROM bookings b WHERE b.member_id = p_member_id AND b.attended = true
      UNION ALL
      SELECT d.session_id FROM drop_in_attendances d WHERE d.member_id = p_member_id
    ) ev
    JOIN class_sessions cs ON cs.id = ev.session_id
    WHERE cs.instructor_id IS NOT NULL;

    IF v_distinct_instructors >= 5 THEN
      INSERT INTO member_achievements (studio_id, member_id, achievement_type)
      VALUES (p_studio_id, p_member_id, 'five_instructors')
      ON CONFLICT (member_id, achievement_type) DO NOTHING;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM member_achievements
    WHERE member_id = p_member_id AND achievement_type = 'five_class_types'
  ) THEN
    SELECT count(DISTINCT c.class_type)
    INTO v_distinct_types
    FROM (
      SELECT b.session_id FROM bookings b WHERE b.member_id = p_member_id AND b.attended = true
      UNION ALL
      SELECT d.session_id FROM drop_in_attendances d WHERE d.member_id = p_member_id
    ) ev
    JOIN class_sessions cs ON cs.id = ev.session_id
    JOIN classes c ON c.id = cs.class_id
    WHERE c.class_type IS NOT NULL AND c.class_type <> '';

    IF v_distinct_types >= 5 THEN
      INSERT INTO member_achievements (studio_id, member_id, achievement_type)
      VALUES (p_studio_id, p_member_id, 'five_class_types')
      ON CONFLICT (member_id, achievement_type) DO NOTHING;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM member_achievements
    WHERE member_id = p_member_id AND achievement_type = 'time_explorer'
  ) THEN
    SELECT
      sum(CASE WHEN extract(hour FROM cs.start_time) < 11 THEN 1 ELSE 0 END),
      sum(CASE WHEN extract(hour FROM cs.start_time) BETWEEN 11 AND 16 THEN 1 ELSE 0 END),
      sum(CASE WHEN extract(hour FROM cs.start_time) >= 17 THEN 1 ELSE 0 END)
    INTO v_morning, v_afternoon, v_evening
    FROM (
      SELECT b.session_id FROM bookings b WHERE b.member_id = p_member_id AND b.attended = true
      UNION ALL
      SELECT d.session_id FROM drop_in_attendances d WHERE d.member_id = p_member_id
    ) ev
    JOIN class_sessions cs ON cs.id = ev.session_id
    WHERE cs.start_time IS NOT NULL;

    IF COALESCE(v_morning, 0) > 0
       AND COALESCE(v_afternoon, 0) > 0
       AND COALESCE(v_evening, 0) > 0 THEN
      INSERT INTO member_achievements (studio_id, member_id, achievement_type)
      VALUES (p_studio_id, p_member_id, 'time_explorer')
      ON CONFLICT (member_id, achievement_type) DO NOTHING;
    END IF;
  END IF;
END;
$$;
