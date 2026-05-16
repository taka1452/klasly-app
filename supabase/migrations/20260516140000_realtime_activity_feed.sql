-- Add the high-signal activity feed source tables to the
-- supabase_realtime publication so a dashboard widget can subscribe to
-- INSERTs and refresh the feed live.
--
-- We deliberately do NOT add every source table: members and pass
-- subscriptions are too noisy and the audit logs cover most of what
-- Owner / Manager actually want to react to in real time.

alter publication supabase_realtime add table public.bookings;
alter publication supabase_realtime add table public.class_audit_log;
alter publication supabase_realtime add table public.studio_audit_log;
