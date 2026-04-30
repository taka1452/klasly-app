import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/admin/supabase";

/**
 * Member-initiated recurring booking rules.
 *
 *   GET    /api/member/recurring-bookings              → list mine
 *   POST   /api/member/recurring-bookings              → create / re-enable
 *   DELETE /api/member/recurring-bookings?id=...       → remove
 *   PATCH  /api/member/recurring-bookings              → pause / resume / move
 *
 * The rule is keyed on (member, template, day_of_week, start_time). Whenever
 * /api/member/sessions runs the auto-book sweep, every session in range
 * matching one of the member's active rules gets a booking created if the
 * member doesn't already have one and capacity is available.
 */

async function getSession() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) return null;
  const adminDb = createAdminClient();
  const { data: profile } = await adminDb
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.studio_id) return null;
  return {
    userId: user.id,
    studioId: profile.studio_id as string,
    role: profile.role as string,
    adminDb,
  };
}

export async function GET(request: NextRequest) {
  const ctx = await getSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");

  // Convenience: ?session_id=... returns whether a rule exists for this
  // session's slot, so the calendar popover can light up its toggle.
  if (sessionId) {
    const { data: session } = await ctx.adminDb
      .from("class_sessions")
      .select("template_id, session_date, start_time, studio_id")
      .eq("id", sessionId)
      .single();
    if (!session || session.studio_id !== ctx.studioId) {
      return NextResponse.json({ rule: null });
    }
    const [y, m, d] = (session.session_date as string).split("-").map(Number);
    const dow = new Date(y || 1970, (m || 1) - 1, d || 1).getDay();
    const startTime = (session.start_time as string).slice(0, 8);

    const { data: rule } = await ctx.adminDb
      .from("recurring_bookings")
      .select("id, is_active, paused_until")
      .eq("member_id", ctx.userId)
      .eq("template_id", session.template_id as string)
      .eq("day_of_week", dow)
      .eq("start_time", startTime)
      .maybeSingle();

    return NextResponse.json({ rule: rule ?? null });
  }

  const { data, error } = await ctx.adminDb
    .from("recurring_bookings")
    .select(
      "id, template_id, day_of_week, start_time, is_active, paused_until, created_at, class_templates(name)"
    )
    .eq("member_id", ctx.userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rules: data ?? [] });
}

export async function POST(request: NextRequest) {
  const ctx = await getSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    template_id?: string;
    day_of_week?: number;
    start_time?: string;
    /**
     * Convenience: pass any matching `session_id` instead of the explicit
     * (template_id, day_of_week, start_time) trio. Used by the popover
     * "Book me weekly" toggle, which has the session id but doesn't
     * surface the template id directly to the client.
     */
    session_id?: string;
  };

  let templateId = body.template_id;
  let dow = body.day_of_week;
  let startTime = (body.start_time ?? "").slice(0, 8);

  if (body.session_id && (!templateId || typeof dow !== "number" || !startTime)) {
    const { data: session } = await ctx.adminDb
      .from("class_sessions")
      .select("template_id, session_date, start_time, studio_id")
      .eq("id", body.session_id)
      .single();
    if (!session || session.studio_id !== ctx.studioId) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    templateId = templateId ?? (session.template_id as string);
    if (typeof dow !== "number") {
      const [y, m, d] = (session.session_date as string).split("-").map(Number);
      dow = new Date(y || 1970, (m || 1) - 1, d || 1).getDay();
    }
    if (!startTime) {
      startTime = (session.start_time as string).slice(0, 8);
    }
  }

  if (!templateId || typeof templateId !== "string") {
    return NextResponse.json(
      { error: "template_id is required" },
      { status: 400 }
    );
  }
  if (typeof dow !== "number" || dow < 0 || dow > 6) {
    return NextResponse.json(
      { error: "day_of_week must be 0..6" },
      { status: 400 }
    );
  }
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(startTime)) {
    return NextResponse.json(
      { error: "start_time must be HH:MM[:SS]" },
      { status: 400 }
    );
  }

  // Verify the template lives in this studio.
  const { data: tmpl } = await ctx.adminDb
    .from("class_templates")
    .select("id, studio_id")
    .eq("id", templateId)
    .single();
  if (!tmpl || tmpl.studio_id !== ctx.studioId) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Upsert: re-enable the existing rule if the unique key already matches.
  const { data: existing } = await ctx.adminDb
    .from("recurring_bookings")
    .select("id")
    .eq("member_id", ctx.userId)
    .eq("template_id", templateId)
    .eq("day_of_week", dow)
    .eq("start_time", startTime.length === 5 ? `${startTime}:00` : startTime)
    .maybeSingle();

  if (existing?.id) {
    const { data: updated, error } = await ctx.adminDb
      .from("recurring_bookings")
      .update({ is_active: true, paused_until: null })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ rule: updated, reused: true });
  }

  const { data: inserted, error: insertErr } = await ctx.adminDb
    .from("recurring_bookings")
    .insert({
      studio_id: ctx.studioId,
      member_id: ctx.userId,
      template_id: templateId,
      day_of_week: dow,
      start_time: startTime.length === 5 ? `${startTime}:00` : startTime,
      is_active: true,
    })
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ rule: inserted, reused: false });
}

export async function PATCH(request: NextRequest) {
  const ctx = await getSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    is_active?: boolean;
    paused_until?: string | null;
  };

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.is_active === "boolean") updates.is_active = body.is_active;
  if (body.paused_until === null || typeof body.paused_until === "string") {
    updates.paused_until = body.paused_until;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await ctx.adminDb
    .from("recurring_bookings")
    .update(updates)
    .eq("id", body.id)
    .eq("member_id", ctx.userId)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  return NextResponse.json({ rule: data });
}

export async function DELETE(request: NextRequest) {
  const ctx = await getSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await ctx.adminDb
    .from("recurring_bookings")
    .delete()
    .eq("id", id)
    .eq("member_id", ctx.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
