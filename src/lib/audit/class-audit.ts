import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Append-only audit logging for class templates and class sessions.
 *
 * Why a helper instead of writing directly: each call site (the session
 * PUT, the session DELETE, the template PUT) needs to capture the same
 * shape — actor, change_type, before/after, summary — and they all use
 * the same service-role supabase client. Centralising keeps the writes
 * consistent and makes it easy to add a sentinel for unknown change
 * types (so the audit table doesn't grow garbage strings).
 *
 * Failures are swallowed: an audit write must never block the
 * underlying operation. The user wants the schedule edit to land —
 * losing one history row is recoverable, losing a manager's edit is
 * not.
 *
 * Jamie feedback 2026-04-30 (Requests and Questions): "We need a
 * history of changes and updates made to all classes to track
 * contracted hours per instructor."
 */

export type ClassAuditChangeType =
  | "session_created"
  | "session_updated"
  | "session_cancelled"
  | "session_uncancelled"
  | "session_instructor_changed"
  | "session_time_changed"
  | "session_date_changed"
  | "session_room_changed"
  | "session_hours_returned"
  | "template_updated"
  | "template_price_changed"
  | "template_duration_changed"
  | "template_capacity_changed"
  | "template_instructor_changed";

type Args = {
  studioId: string;
  templateId?: string | null;
  sessionId?: string | null;
  actorProfileId?: string | null;
  actorRole?: string | null;
  changeType: ClassAuditChangeType;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  summary: string;
};

export async function logClassAudit(
  supabase: SupabaseClient,
  args: Args
): Promise<void> {
  try {
    await supabase.from("class_audit_log").insert({
      studio_id: args.studioId,
      template_id: args.templateId ?? null,
      session_id: args.sessionId ?? null,
      actor_profile_id: args.actorProfileId ?? null,
      actor_role: args.actorRole ?? null,
      change_type: args.changeType,
      before: args.before ?? null,
      after: args.after ?? null,
      summary: args.summary,
    });
  } catch (err) {
    // Never let an audit failure break the underlying operation.
    console.error("[class-audit] log write failed", err);
  }
}
