-- Class change history (Jamie 2026-04-30): "We need a history of changes
-- and updates made to all classes to track contracted hours per
-- instructor."
--
-- Single audit log table that captures both class_template-level and
-- class_session-level edits. Sessions vs templates are discriminated by
-- whether session_id or template_id is set; both can be set when a
-- session-level change is also relevant to its template's history view.
--
-- Writes are app-side from the API handlers (PUT/DELETE on
-- /api/sessions/[id] and /api/class-templates/[id]) so we can capture
-- the actor reliably. A future migration can add a SQL trigger as a
-- safety net for direct-to-DB edits.

create table if not exists public.class_audit_log (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null,
  template_id uuid,
  session_id uuid,
  -- Who made the change. We don't FK to profiles because rows should
  -- survive even if the actor profile is later deleted.
  actor_profile_id uuid,
  actor_role text,
  -- Coarse classification — used to render an icon / colour in the UI
  -- and to filter (e.g. "show only instructor swaps").
  change_type text not null,
  -- Optional structured before/after blobs. Used for "X minutes → Y
  -- minutes" style diffs and audit replay. Free-form so different
  -- change_types can carry whatever structure is useful.
  before jsonb,
  after jsonb,
  -- Pre-rendered short string for the timeline list row. Saves the UI
  -- from having to know every change_type.
  summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists class_audit_log_template_idx
  on public.class_audit_log (template_id, created_at desc)
  where template_id is not null;

create index if not exists class_audit_log_session_idx
  on public.class_audit_log (session_id, created_at desc)
  where session_id is not null;

create index if not exists class_audit_log_studio_idx
  on public.class_audit_log (studio_id, created_at desc);

comment on table public.class_audit_log is
  'Append-only history of class template and session changes. Read by the dashboard to surface a per-class change log; never updated, only inserted.';

-- RLS: studio members read their own studio's log. Inserts come from
-- service-role API handlers, so the policy is read-only for clients.
alter table public.class_audit_log enable row level security;

drop policy if exists class_audit_log_select_own_studio on public.class_audit_log;
create policy class_audit_log_select_own_studio
  on public.class_audit_log
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.studio_id = class_audit_log.studio_id
    )
  );
