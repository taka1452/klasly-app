-- Customizable booking confirmation emails (Jamie 2026-05-14):
--   * Studio-wide default subject + body for class and event confirmations
--   * Optional per-class / per-event override
--
-- Both subject and body support the variables: {memberName}, {className}
-- (or {eventName}), {sessionDate}, {startTime}, {studioName}. Plain
-- string interpolation is fine — these emails are admin-authored, so we
-- aren't trying to defend against template injection. Sanitisation
-- happens once when rendered.

alter table public.studios
  add column if not exists class_confirmation_subject text,
  add column if not exists class_confirmation_body text,
  add column if not exists event_confirmation_subject text,
  add column if not exists event_confirmation_body text,
  add column if not exists confirmation_sender_name text;

alter table public.class_templates
  add column if not exists confirmation_subject_override text,
  add column if not exists confirmation_body_override text;

alter table public.events
  add column if not exists confirmation_subject_override text,
  add column if not exists confirmation_body_override text;
