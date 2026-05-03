-- ============================================================
-- Fix SECURITY DEFINER functions missing SET search_path = ''
-- Prevents search_path manipulation attacks on privileged functions.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. get_owner_studio_id (had SET search_path = public → change to '')
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_owner_studio_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT studio_id FROM public.profiles
  WHERE id = auth.uid() AND role = 'owner'
  LIMIT 1;
$$;

-- ────────────────────────────────────────────────────────────
-- 2. Atomic credit operations
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decrement_member_credits(
  p_member_id uuid,
  p_amount int DEFAULT 1
)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new_credits int;
BEGIN
  UPDATE public.members
  SET credits = credits - p_amount
  WHERE id = p_member_id
    AND credits >= p_amount
    AND credits >= 0
  RETURNING credits INTO v_new_credits;

  IF NOT FOUND THEN
    SELECT credits INTO v_new_credits
    FROM public.members
    WHERE id = p_member_id;

    IF v_new_credits = -1 THEN
      RETURN -1;
    END IF;

    RETURN -99;
  END IF;

  RETURN v_new_credits;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_member_credits(
  p_member_id uuid,
  p_amount int DEFAULT 1
)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new_credits int;
BEGIN
  UPDATE public.members
  SET credits = credits + p_amount
  WHERE id = p_member_id
    AND credits >= 0
  RETURNING credits INTO v_new_credits;

  IF NOT FOUND THEN
    SELECT credits INTO v_new_credits
    FROM public.members
    WHERE id = p_member_id;
    RETURN COALESCE(v_new_credits, 0);
  END IF;

  RETURN v_new_credits;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_pass_usage(
  p_subscription_id uuid
)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new_count int;
BEGIN
  UPDATE public.pass_subscriptions
  SET classes_used_this_period = classes_used_this_period + 1
  WHERE id = p_subscription_id
  RETURNING classes_used_this_period INTO v_new_count;

  RETURN COALESCE(v_new_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_pass_usage(
  p_subscription_id uuid
)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new_count int;
BEGIN
  UPDATE public.pass_subscriptions
  SET classes_used_this_period = GREATEST(0, classes_used_this_period - 1)
  WHERE id = p_subscription_id
  RETURNING classes_used_this_period INTO v_new_count;

  RETURN COALESCE(v_new_count, 0);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 3. get_instructor_used_minutes (3-param overload)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_instructor_used_minutes(
  p_instructor_id uuid,
  p_year integer,
  p_month integer
)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    SUM(duration_minutes),
    0
  )::int
  FROM public.class_sessions
  WHERE instructor_id = p_instructor_id
    AND (
      is_cancelled = false
      OR (is_cancelled = true AND hours_returned = false)
    )
    AND EXTRACT(YEAR FROM session_date) = p_year
    AND EXTRACT(MONTH FROM session_date) = p_month;
$$;

-- ────────────────────────────────────────────────────────────
-- 4. get_instructor_used_minutes (4-param overload)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_instructor_used_minutes(
  p_instructor_id uuid,
  p_studio_id uuid,
  p_month_start date,
  p_month_end date
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE total integer;
BEGIN
  SELECT COALESCE(SUM(CASE
    WHEN duration_minutes IS NOT NULL THEN duration_minutes
    WHEN end_time IS NOT NULL AND start_time IS NOT NULL THEN
      EXTRACT(EPOCH FROM (end_time::time - start_time::time))::integer / 60
    ELSE 0 END), 0) INTO total
  FROM public.class_sessions
  WHERE instructor_id = p_instructor_id
    AND studio_id = p_studio_id
    AND room_id IS NOT NULL
    AND (
      is_cancelled = false
      OR (is_cancelled = true AND hours_returned = false)
    )
    AND session_date >= p_month_start
    AND session_date <= p_month_end;
  RETURN total;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 5. check_room_availability (DROP + CREATE due to parameter rename)
-- ────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.check_room_availability(uuid, date, time, time, uuid);

CREATE FUNCTION public.check_room_availability(
  p_room_id uuid,
  p_booking_date date,
  p_start_time time,
  p_end_time time,
  p_exclude_booking_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.instructor_room_bookings
    WHERE room_id = p_room_id
      AND booking_date = p_booking_date
      AND status = 'confirmed'
      AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id)
      AND start_time < p_end_time
      AND end_time > p_start_time
  );
$$;

-- ────────────────────────────────────────────────────────────
-- 6. update_member_waiver_on_sign (trigger function)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_member_waiver_on_sign()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.token_used = true AND (OLD.token_used = false OR OLD.token_used IS NULL) THEN
    UPDATE public.members
    SET waiver_signed = true, waiver_signed_at = NEW.signed_at
    WHERE id = NEW.member_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 7. get_session_availability
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_session_availability(
  p_studio_id UUID,
  p_session_ids UUID[]
)
RETURNS TABLE(session_id UUID, confirmed_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT b.session_id, COUNT(*)::BIGINT AS confirmed_count
  FROM public.bookings b
  WHERE b.session_id = ANY(p_session_ids)
    AND b.studio_id = p_studio_id
    AND b.status = 'confirmed'
  GROUP BY b.session_id;
$$;

-- ────────────────────────────────────────────────────────────
-- 8. increment_member_lifetime_classes
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_member_lifetime_classes(p_member_id UUID, p_studio_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
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

  UPDATE public.members
  SET lifetime_classes_attended = lifetime_classes_attended + 1,
      comeback_card_until = NULL
  WHERE id = p_member_id
  RETURNING lifetime_classes_attended, current_rank, last_attended_week,
            current_streak_weeks, longest_streak_weeks
  INTO v_count, v_old_rank, v_last_week, v_streak, v_longest;

  IF v_count IS NULL THEN
    RETURN;
  END IF;

  IF v_last_week IS NULL THEN
    v_streak := 1;
  ELSIF v_last_week = v_this_week THEN
    NULL;
  ELSIF v_last_week = v_this_week - INTERVAL '7 day' THEN
    v_streak := v_streak + 1;
  ELSE
    v_streak := 1;
  END IF;
  IF v_streak > v_longest THEN
    v_longest := v_streak;
  END IF;

  UPDATE public.members
  SET last_attended_week = v_this_week,
      current_streak_weeks = v_streak,
      longest_streak_weeks = v_longest
  WHERE id = p_member_id;

  v_new_rank := CASE
    WHEN v_count >= 300 THEN 'diamond'
    WHEN v_count >= 100 THEN 'platinum'
    WHEN v_count >= 30 THEN 'gold'
    WHEN v_count >= 10 THEN 'silver'
    ELSE 'bronze'
  END;
  IF v_new_rank <> v_old_rank THEN
    UPDATE public.members
    SET current_rank = v_new_rank,
        rank_celebrated_at = NULL
    WHERE id = p_member_id;
  END IF;

  IF v_count = 1 THEN
    INSERT INTO public.member_achievements (studio_id, member_id, achievement_type)
    VALUES (p_studio_id, p_member_id, 'first_class')
    ON CONFLICT (member_id, achievement_type) DO NOTHING;
  ELSIF v_count = 5 THEN
    INSERT INTO public.member_achievements (studio_id, member_id, achievement_type)
    VALUES (p_studio_id, p_member_id, 'five_classes')
    ON CONFLICT (member_id, achievement_type) DO NOTHING;
  ELSIF v_count = 10 THEN
    INSERT INTO public.member_achievements (studio_id, member_id, achievement_type)
    VALUES (p_studio_id, p_member_id, 'ten_classes')
    ON CONFLICT (member_id, achievement_type) DO NOTHING;
  ELSIF v_count = 25 THEN
    INSERT INTO public.member_achievements (studio_id, member_id, achievement_type)
    VALUES (p_studio_id, p_member_id, 'twenty_five_classes')
    ON CONFLICT (member_id, achievement_type) DO NOTHING;
  ELSIF v_count = 50 THEN
    INSERT INTO public.member_achievements (studio_id, member_id, achievement_type)
    VALUES (p_studio_id, p_member_id, 'fifty_classes')
    ON CONFLICT (member_id, achievement_type) DO NOTHING;
  END IF;

  IF v_streak >= 1 THEN
    INSERT INTO public.member_achievements (studio_id, member_id, achievement_type)
    VALUES (p_studio_id, p_member_id, 'streak_7_days')
    ON CONFLICT (member_id, achievement_type) DO NOTHING;
  END IF;
  IF v_streak >= 4 THEN
    INSERT INTO public.member_achievements (studio_id, member_id, achievement_type)
    VALUES (p_studio_id, p_member_id, 'streak_30_days')
    ON CONFLICT (member_id, achievement_type) DO NOTHING;
  END IF;
  IF v_streak >= 13 THEN
    INSERT INTO public.member_achievements (studio_id, member_id, achievement_type)
    VALUES (p_studio_id, p_member_id, 'streak_90_days')
    ON CONFLICT (member_id, achievement_type) DO NOTHING;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.member_achievements
    WHERE member_id = p_member_id AND achievement_type = 'five_instructors'
  ) THEN
    SELECT count(DISTINCT cs.instructor_id)
    INTO v_distinct_instructors
    FROM (
      SELECT b.session_id FROM public.bookings b WHERE b.member_id = p_member_id AND b.attended = true
      UNION ALL
      SELECT d.session_id FROM public.drop_in_attendances d WHERE d.member_id = p_member_id
    ) ev
    JOIN public.class_sessions cs ON cs.id = ev.session_id
    WHERE cs.instructor_id IS NOT NULL;

    IF v_distinct_instructors >= 5 THEN
      INSERT INTO public.member_achievements (studio_id, member_id, achievement_type)
      VALUES (p_studio_id, p_member_id, 'five_instructors')
      ON CONFLICT (member_id, achievement_type) DO NOTHING;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.member_achievements
    WHERE member_id = p_member_id AND achievement_type = 'five_class_types'
  ) THEN
    SELECT count(DISTINCT c.class_type)
    INTO v_distinct_types
    FROM (
      SELECT b.session_id FROM public.bookings b WHERE b.member_id = p_member_id AND b.attended = true
      UNION ALL
      SELECT d.session_id FROM public.drop_in_attendances d WHERE d.member_id = p_member_id
    ) ev
    JOIN public.class_sessions cs ON cs.id = ev.session_id
    JOIN public.classes c ON c.id = cs.class_id
    WHERE c.class_type IS NOT NULL AND c.class_type <> '';

    IF v_distinct_types >= 5 THEN
      INSERT INTO public.member_achievements (studio_id, member_id, achievement_type)
      VALUES (p_studio_id, p_member_id, 'five_class_types')
      ON CONFLICT (member_id, achievement_type) DO NOTHING;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.member_achievements
    WHERE member_id = p_member_id AND achievement_type = 'time_explorer'
  ) THEN
    SELECT
      sum(CASE WHEN extract(hour FROM cs.start_time) < 11 THEN 1 ELSE 0 END),
      sum(CASE WHEN extract(hour FROM cs.start_time) BETWEEN 11 AND 16 THEN 1 ELSE 0 END),
      sum(CASE WHEN extract(hour FROM cs.start_time) >= 17 THEN 1 ELSE 0 END)
    INTO v_morning, v_afternoon, v_evening
    FROM (
      SELECT b.session_id FROM public.bookings b WHERE b.member_id = p_member_id AND b.attended = true
      UNION ALL
      SELECT d.session_id FROM public.drop_in_attendances d WHERE d.member_id = p_member_id
    ) ev
    JOIN public.class_sessions cs ON cs.id = ev.session_id
    WHERE cs.start_time IS NOT NULL;

    IF COALESCE(v_morning, 0) > 0
       AND COALESCE(v_afternoon, 0) > 0
       AND COALESCE(v_evening, 0) > 0 THEN
      INSERT INTO public.member_achievements (studio_id, member_id, achievement_type)
      VALUES (p_studio_id, p_member_id, 'time_explorer')
      ON CONFLICT (member_id, achievement_type) DO NOTHING;
    END IF;
  END IF;
END;
$$;
