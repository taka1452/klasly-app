-- ============================================================
-- Fix: PostgreSQL forbids `FOR UPDATE` together with aggregate
-- functions (e.g. `count(*) ... FOR UPDATE`). The original
-- atomic_book_session function failed at runtime on the member
-- booking screen with:
--   "FOR UPDATE is not allowed with aggregate functions"
--
-- Root cause: we were trying to do row-level locking and counting
-- in one statement, which Postgres rejects. Even if it were
-- allowed, FOR UPDATE only locks existing rows — concurrent
-- INSERTs would not be blocked, so it wouldn't fully prevent
-- TOCTOU overbooking anyway.
--
-- Fix: use a transaction-scoped advisory lock keyed on the
-- session id. pg_advisory_xact_lock serializes concurrent calls
-- for the same session and is automatically released at COMMIT
-- / ROLLBACK. This both fixes the runtime error and makes the
-- capacity check + insert genuinely atomic.
-- ============================================================

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
  -- Serialize concurrent bookings for the same session.
  -- The lock is released at the end of the surrounding transaction.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_session_id::text, 0));

  SELECT count(*) INTO v_confirmed_count
  FROM public.bookings
  WHERE session_id = p_session_id
    AND status = 'confirmed';

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
