-- ============================================================
-- Fix TOCTOU race conditions in booking capacity and pass usage.
-- Both functions perform check-then-act atomically within a
-- single SQL statement to prevent concurrent overbooking.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Atomic booking: check capacity + insert in one transaction
--    Returns the booking status: 'confirmed' or 'waitlist'
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.atomic_book_session(
  p_session_id uuid,
  p_member_id uuid,
  p_studio_id uuid,
  p_capacity int,
  p_booked_via_pass boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_confirmed_count int;
  v_status text;
BEGIN
  -- Lock the session's bookings to prevent concurrent inserts
  -- COUNT with FOR UPDATE on matching rows serializes concurrent calls
  SELECT count(*) INTO v_confirmed_count
  FROM public.bookings
  WHERE session_id = p_session_id
    AND status = 'confirmed'
  FOR UPDATE;

  IF v_confirmed_count >= p_capacity THEN
    v_status := 'waitlist';
  ELSE
    v_status := 'confirmed';
  END IF;

  INSERT INTO public.bookings (studio_id, session_id, member_id, status, booked_via_pass)
  VALUES (p_studio_id, p_session_id, p_member_id, v_status, p_booked_via_pass);

  RETURN v_status;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 2. Atomic pass usage: check capacity + increment in one UPDATE
--    Returns new count, or -1 if at capacity (no update performed)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.atomic_increment_pass_usage(
  p_subscription_id uuid,
  p_max_classes int DEFAULT NULL
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
    AND (p_max_classes IS NULL OR classes_used_this_period < p_max_classes)
  RETURNING classes_used_this_period INTO v_new_count;

  IF NOT FOUND THEN
    RETURN -1;
  END IF;

  RETURN v_new_count;
END;
$$;
