import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { getInstructorContext } from "@/lib/auth/instructor-access";
import { NextResponse } from "next/server";

/**
 * POST /api/sessions/[id]/make-recurring
 * Convert a single (non-recurring) session into an ongoing weekly recurrence.
 * - Assigns a new recurrence_group_id + recurrence_rule = 'weekly' to this session.
 * - The generate-sessions cron will pick it up and fill the rolling window.
 * - Optionally pass { end_date: 'YYYY-MM-DD' } to set a hard end on the template.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const endDate =
      typeof body?.end_date === "string" && body.end_date.length === 10
        ? body.end_date
        : null;

    const dashCtx = await getDashboardContext();
    let supabase;
    let studioId: string;
    let instructorId: string | null = null;

    if (dashCtx) {
      if (
        dashCtx.role === "manager" &&
        !dashCtx.permissions?.can_manage_classes
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      supabase = dashCtx.supabase;
      studioId = dashCtx.studioId;
    } else {
      const instrCtx = await getInstructorContext();
      if (!instrCtx) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      supabase = instrCtx.supabase;
      studioId = instrCtx.studioId;
      instructorId = instrCtx.instructorId;
    }

    const { data: session } = await supabase
      .from("class_sessions")
      .select(
        "id, studio_id, instructor_id, template_id, recurrence_group_id, is_cancelled"
      )
      .eq("id", id)
      .single();

    if (!session || session.studio_id !== studioId) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    if (instructorId && session.instructor_id !== instructorId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (session.is_cancelled) {
      return NextResponse.json(
        { error: "Cannot convert a cancelled session" },
        { status: 400 }
      );
    }

    if (session.recurrence_group_id) {
      return NextResponse.json(
        { error: "Session is already part of a recurring series" },
        { status: 400 }
      );
    }

    const recurrenceGroupId = crypto.randomUUID();

    const { error: updateErr } = await supabase
      .from("class_sessions")
      .update({
        recurrence_group_id: recurrenceGroupId,
        recurrence_rule: "weekly",
      })
      .eq("id", id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Apply end date / clear based on template
    if (session.template_id) {
      await supabase
        .from("class_templates")
        .update({ recurrence_end_date: endDate })
        .eq("id", session.template_id);
    }

    return NextResponse.json(
      {
        success: true,
        recurrence_group_id: recurrenceGroupId,
        end_date: endDate,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
