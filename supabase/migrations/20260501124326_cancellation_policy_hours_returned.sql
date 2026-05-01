-- Jamie feedback 2026-04-30: "if an instructor cancels a class — only we
-- as admins have the ability to give those hours back to them for use that
-- month."
--
-- Today get_instructor_used_minutes excludes any session with
-- is_cancelled=true, so an instructor who cancels their own class silently
-- frees up their hours. We add two columns to class_sessions:
--
-- 1. cancelled_by_role: who cancelled it (owner | manager | instructor).
--    Useful for the dashboard so the studio can see at a glance which
--    cancellations were caller-initiated.
-- 2. hours_returned: whether the cancelled session's minutes have been
--    returned to the instructor's monthly hour pool.
--    - admin cancellations default to TRUE (cancellation reason is the
--      studio's, not the teacher's, so the teacher keeps their pool).
--    - instructor cancellations default to FALSE (teacher forfeits the
--      hours, admin can flip on the cancelled tile to grant them back).
--
-- get_instructor_used_minutes is updated to count cancelled sessions
-- whose hours_returned = false, so a self-cancellation by the teacher
-- still consumes their monthly allowance until an admin overrides it.

alter table public.class_sessions
  add column if not exists cancelled_by_role text,
  add column if not exists hours_returned boolean;

do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_schema = 'public'
      and table_name = 'class_sessions'
      and constraint_name = 'class_sessions_cancelled_by_role_check'
  ) then
    alter table public.class_sessions
      add constraint class_sessions_cancelled_by_role_check
      check (cancelled_by_role is null or cancelled_by_role in ('owner', 'manager', 'instructor'));
  end if;
end$$;

comment on column public.class_sessions.cancelled_by_role is
  'owner | manager | instructor — the role of the user who cancelled this session. Null when the session was never cancelled.';
comment on column public.class_sessions.hours_returned is
  'When true, a cancelled session is excluded from the instructor''s monthly minute total. Default semantics: admin cancellations true, instructor cancellations false. Admins can flip this from the cancelled tile to refund or revoke the hours.';

-- Update both overloads of get_instructor_used_minutes to count cancelled
-- sessions whose hours_returned is explicitly false. Sessions that were
-- never cancelled (is_cancelled=false) keep counting; sessions that were
-- cancelled with hours_returned=true (or null, for legacy rows) drop out.

CREATE OR REPLACE FUNCTION public.get_instructor_used_minutes(
  p_instructor_id uuid,
  p_year integer,
  p_month integer
)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_instructor_used_minutes(
  p_instructor_id uuid,
  p_studio_id uuid,
  p_month_start date,
  p_month_end date
)
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE total integer;
BEGIN
  SELECT COALESCE(SUM(CASE
    WHEN duration_minutes IS NOT NULL THEN duration_minutes
    WHEN end_time IS NOT NULL AND start_time IS NOT NULL THEN
      EXTRACT(EPOCH FROM (end_time::time - start_time::time))::integer / 60
    ELSE 0 END), 0) INTO total
  FROM class_sessions
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
$function$;
