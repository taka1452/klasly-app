import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { runReport } from "@/lib/reports/runner";
import type { ReportFilters, ReportType } from "@/lib/reports/types";

async function getAnalyticsContext() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) return null;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.studio_id) return null;

  if (profile.role === "owner") {
    return { supabase, studioId: profile.studio_id };
  }
  if (profile.role === "manager") {
    const { data: manager } = await supabase
      .from("managers")
      .select("can_view_payments")
      .eq("profile_id", user.id)
      .eq("studio_id", profile.studio_id)
      .single();
    if (!manager?.can_view_payments) return null;
    return { supabase, studioId: profile.studio_id };
  }
  return null;
}

/**
 *   GET    /api/reports/:id         — load a saved report definition
 *   POST   /api/reports/:id?action=run — run the saved report (uses its stored filters)
 *   PATCH  /api/reports/:id         — update name/filters/is_favorite
 *   DELETE /api/reports/:id
 */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAnalyticsContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { data, error } = await ctx.supabase
    .from("saved_reports")
    .select("*")
    .eq("id", id)
    .eq("studio_id", ctx.studioId)
    .single();
  if (error) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAnalyticsContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action !== "run") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const { data: saved } = await ctx.supabase
    .from("saved_reports")
    .select("*")
    .eq("id", id)
    .eq("studio_id", ctx.studioId)
    .single();
  if (!saved) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const result = await runReport(
      ctx.supabase,
      ctx.studioId,
      saved.report_type as ReportType,
      (saved.filters || {}) as ReportFilters
    );
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to run report" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAnalyticsContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined)
    updates.name =
      typeof body.name === "string" && body.name.trim().length > 0
        ? body.name.trim()
        : null;
  if (body.description !== undefined)
    updates.description =
      typeof body.description === "string" && body.description.trim().length > 0
        ? body.description.trim()
        : null;
  if (body.report_type !== undefined) updates.report_type = body.report_type;
  if (body.filters !== undefined) updates.filters = body.filters;
  if (body.is_favorite !== undefined) updates.is_favorite = !!body.is_favorite;

  const { data, error } = await ctx.supabase
    .from("saved_reports")
    .update(updates)
    .eq("id", id)
    .eq("studio_id", ctx.studioId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAnalyticsContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { error } = await ctx.supabase
    .from("saved_reports")
    .delete()
    .eq("id", id)
    .eq("studio_id", ctx.studioId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
