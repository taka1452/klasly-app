-- Per-class required waivers (Jamie 2026-05-14): a class can require one
-- or more waiver templates be signed before a member can book it. Stored
-- as an array of waiver_template ids so we don't need a junction table —
-- studios typically have <10 waivers, so array ops are cheap.
alter table public.class_templates
  add column if not exists required_waiver_template_ids uuid[] not null default '{}';

alter table public.events
  add column if not exists required_waiver_template_ids uuid[] not null default '{}';
