-- Studio-wide audit log: settings, pricing, permissions, closures.
--
-- Companion to class_audit_log but tracks changes that affect the
-- studio as a whole (e.g. plan changes, manager permission toggles,
-- studio closures, pricing edits). Append-only — never updated.
--
-- Writes are app-side from API handlers so we can capture the actor
-- reliably. Read by the dashboard Activity feed to surface "operations"
-- events to Owner / Manager(settings).

create table if not exists public.studio_audit_log (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  -- Who made the change. We don't FK to profiles because rows should
  -- survive even if the actor profile is later deleted.
  actor_profile_id uuid,
  actor_role text,
  -- Coarse classification — used to render an icon / colour in the UI
  -- and to filter (e.g. "show only permission changes").
  change_type text not null,
  -- Optional pointers to the entity that changed; nullable because
  -- some changes are studio-level (e.g. cancellation policy toggle).
  target_table text,
  target_id uuid,
  -- Optional structured before/after blobs for diff replay.
  before jsonb,
  after jsonb,
  -- Pre-rendered short string for the timeline list row.
  summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists studio_audit_log_studio_idx
  on public.studio_audit_log (studio_id, created_at desc);

create index if not exists studio_audit_log_change_type_idx
  on public.studio_audit_log (studio_id, change_type, created_at desc);

comment on table public.studio_audit_log is
  'Append-only history of studio-level changes (settings, pricing, permissions, closures). Read by the dashboard activity feed.';

-- RLS: studio members read their own studio's log. Inserts come from
-- service-role API handlers, so the policy is read-only for clients.
alter table public.studio_audit_log enable row level security;

drop policy if exists studio_audit_log_select_own_studio on public.studio_audit_log;
create policy studio_audit_log_select_own_studio
  on public.studio_audit_log
  for select
  using (
    studio_id in (
      select studio_id from profiles where id = (select auth.uid())
    )
  );
