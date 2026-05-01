import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { NextResponse } from "next/server";
import { logClassAudit } from "@/lib/audit/class-audit";

/**
 * POST /api/sessions/[id]/hours-returned
 *
 * Owner/manager-only override on a cancelled session's `hours_returned`
 * flag — flipping it controls whether the instructor's monthly minute
 * total still includes that session.
 *
 * Default semantics live in `cancelSession` (see route.ts):
 * - admin cancels → hours_returned = true  (instructor keeps the slot)
 * - instructor self-cancels → hours_returned = false (instructor forfeits)
 *
 * Jamie feedback 2026-04-30: "if an instructor cancels a class — only we
 * as admins have the ability to give those hours back to them for use
 * that month."
 *
 * Body: `{ hours_returned: boolean }`
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getDashboardContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Only admins can override this — managers need can_manage_classes.
    if (ctx.role === "manager" && !ctx.permissions?.can_manage_classes) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    if (typeof body?.hours_returned !== "boolean") {
      return NextResponse.json(
        { error: "Body must include hours_returned: boolean" },
        { status: 400 }
      );
    }

    const { data: existing } = await ctx.supabase
      .from("class_sessions")
      .select("id, studio_id, is_cancelled, hours_returned, template_id")
      .eq("id", id)
      .single();
    if (!existing || existing.studio_id !== ctx.studioId) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (!existing.is_cancelled) {
      return NextResponse.json(
        { error: "Only cancelled sessions can have their hours_returned flipped." },
        { status: 400 }
      );
    }

    const { error } = await ctx.supabase
      .from("class_sessions")
      .update({ hours_returned: body.hours_returned })
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (existing.hours_returned !== body.hours_returned) {
      await logClassAudit(ctx.supabase, {
        studioId: ctx.studioId,
        templateId: existing.template_id ?? null,
        sessionId: id,
        actorProfileId: ctx.userId,
        actorRole: ctx.role,
        changeType: "session_hours_returned",
        before: { hours_returned: existing.hours_returned },
        after: { hours_returned: body.hours_returned },
        summary: body.hours_returned
          ? "Hours returned to instructor"
          : "Hours revoked from instructor",
      });
    }

    return NextResponse.json({ success: true, hours_returned: body.hours_returned });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
