-- Free-form overview text displayed above the per-activity schedule timeline.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS schedule_overview text;
