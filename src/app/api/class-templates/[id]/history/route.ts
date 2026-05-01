import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { NextResponse } from "next/server";

/**
 * GET /api/class-templates/[id]/history
 *
 * Returns the change log for a class template — every audited edit on
 * the template itself plus every audited edit on any of its sessions.
 * Joined with the actor's profile to render "Sarah · 3 hours ago" rows.
 *
 * Read access: owner / any manager in the studio (no separate
 * permission). Even managers without can_manage_classes benefit from
 * seeing the history while they triage; the toggle on the template
 * page is hidden for non-managers anyway.
 *
 * Jamie feedback 2026-04-30: "We need a history of changes and updates
 * made to all classes to track contracted hours per instructor."
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const ctx = await getDashboardContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Anchor: the template must belong to this studio.
    const { data: template } = await ctx.supabase
      .from("class_templates")
      .select("id, studio_id")
      .eq("id", id)
      .single();
    if (!template || template.studio_id !== ctx.studioId) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Pull session ids belonging to this template so we can fetch
    // session-level audit rows in the same query path. Cap at the most
    // recent 500 sessions by session_date — a daily class for nearly 1.5
    // years fits, and older sessions still surface their template-level
    // edits via the byTemplate query below.
    const { data: sessions } = await ctx.supabase
      .from("class_sessions")
      .select("id")
      .eq("template_id", id)
      .eq("studio_id", ctx.studioId)
      .order("session_date", { ascending: false })
      .limit(500);

    const sessionIds = (sessions ?? []).map((s: { id: string }) => s.id);

    // OR: rows tagged with this template_id, OR rows tagged with one of
    // its sessions. We use two queries instead of `.or()` because the
    // session list is potentially long and produces a giant filter
    // string; two indexed queries are simpler and just as fast.
    const [{ data: byTemplate }, { data: bySession }] = await Promise.all([
      ctx.supabase
        .from("class_audit_log")
        .select(
          "id, template_id, session_id, change_type, before, after, summary, actor_profile_id, actor_role, created_at"
        )
        .eq("template_id", id)
        .eq("studio_id", ctx.studioId)
        .order("created_at", { ascending: false })
        .limit(200),
      sessionIds.length === 0
        ? Promise.resolve({ data: [] as { id: string }[] })
        : ctx.supabase
            .from("class_audit_log")
            .select(
              "id, template_id, session_id, change_type, before, after, summary, actor_profile_id, actor_role, created_at"
            )
            .in("session_id", sessionIds)
            .eq("studio_id", ctx.studioId)
            .order("created_at", { ascending: false })
            .limit(500),
    ]);

    // Merge + dedupe (a row may match both queries when both
    // template_id and session_id are set).
    const seen = new Set<string>();
    type Row = {
      id: string;
      change_type: string;
      summary: string;
      actor_profile_id: string | null;
      actor_role: string | null;
      session_id: string | null;
      created_at: string;
      before: unknown;
      after: unknown;
    };
    const merged: Row[] = [];
    for (const r of [...(byTemplate ?? []), ...(bySession ?? [])] as Row[]) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      merged.push(r);
    }
    merged.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const trimmed = merged.slice(0, 200);

    // Resolve actor names in one batched profile fetch so we don't N+1.
    const actorIds = Array.from(
      new Set(
        trimmed
          .map((r) => r.actor_profile_id)
          .filter((x): x is string => Boolean(x))
      )
    );
    let actorMap = new Map<string, string>();
    if (actorIds.length > 0) {
      const { data: actors } = await ctx.supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", actorIds);
      actorMap = new Map(
        (actors ?? []).map((a: { id: string; full_name: string | null }) => [
          a.id,
          a.full_name ?? "Unknown",
        ])
      );
    }

    return NextResponse.json({
      entries: trimmed.map((r) => ({
        id: r.id,
        change_type: r.change_type,
        summary: r.summary,
        actor_name: r.actor_profile_id ? actorMap.get(r.actor_profile_id) ?? null : null,
        actor_role: r.actor_role,
        session_id: r.session_id,
        before: r.before,
        after: r.after,
        created_at: r.created_at,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
