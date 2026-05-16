import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Append-only audit logging for studio-wide changes that affect the
 * whole organization: settings edits, pricing changes, manager
 * permission toggles, studio closures, etc.
 *
 * Companion to logClassAudit — same swallow-errors-never-block contract.
 * Read by the dashboard Activity feed to surface "operations" events.
 */

export type StudioAuditChangeType =
  // Studio-level settings
  | "studio_settings_updated"
  | "studio_policy_updated"
  | "studio_closure_created"
  | "studio_closure_deleted"
  // Pricing / pass / tier
  | "pass_created"
  | "pass_updated"
  | "pass_deleted"
  | "tier_created"
  | "tier_updated"
  | "tier_deleted"
  // Staff / permissions
  | "manager_added"
  | "manager_removed"
  | "manager_permissions_updated"
  | "instructor_added"
  | "instructor_removed";

type Args = {
  studioId: string;
  actorProfileId?: string | null;
  actorRole?: string | null;
  changeType: StudioAuditChangeType;
  targetTable?: string | null;
  targetId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  summary: string;
};

export async function logStudioAudit(
  supabase: SupabaseClient,
  args: Args,
): Promise<void> {
  try {
    await supabase.from("studio_audit_log").insert({
      studio_id: args.studioId,
      actor_profile_id: args.actorProfileId ?? null,
      actor_role: args.actorRole ?? null,
      change_type: args.changeType,
      target_table: args.targetTable ?? null,
      target_id: args.targetId ?? null,
      before: args.before ?? null,
      after: args.after ?? null,
      summary: args.summary,
    });
  } catch (err) {
    // Never let an audit failure break the underlying operation.
    console.error("[studio-audit] log write failed", err);
  }
}
