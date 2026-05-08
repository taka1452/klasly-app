-- Add attendance_method to bookings for hybrid classes.
-- Members choose 'in_person' or 'online' when booking a hybrid class.
-- NULL means the class wasn't hybrid (or legacy data).
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS attendance_method text;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_attendance_method_check
  CHECK (attendance_method IS NULL OR attendance_method IN ('in_person', 'online'));

-- Update atomic_book_session to accept the new column.
CREATE OR REPLACE FUNCTION public.atomic_book_session(
  p_session_id uuid,
  p_member_id uuid,
  p_studio_id uuid,
  p_capacity int,
  p_booked_via_pass boolean DEFAULT false,
  p_attendance_method text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_confirmed_count int;
  v_status text;
BEGIN
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

  INSERT INTO public.bookings (studio_id, session_id, member_id, status, booked_via_pass, attendance_method)
  VALUES (p_studio_id, p_session_id, p_member_id, v_status, p_booked_via_pass, p_attendance_method);

  RETURN v_status;
END;
$$;
