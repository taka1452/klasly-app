-- Jamie / Sarah requests (2026-05-15):
--   * Optional website link on instructor bios
--   * Cancellation policy section on class templates
alter table public.instructors
  add column if not exists website_url text;

alter table public.class_templates
  add column if not exists cancellation_policy text;
