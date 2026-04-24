import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { runReport } from "@/lib/reports/runner";
import type { ReportFilters, ReportType } from "@/lib/reports/types";

/**
 * Analytics report builder endpoints.
 *
 *   GET  /api/reports                  — list saved reports
 *   POST /api/reports                  — save a new report {name, report_type, filters}
 *   POST /api/reports?action=run       — run ad-hoc {report_type, filters} without saving
 */

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
    return { supabase, studioId: profile.studio_id, userId: user.id, role: "owner" as const };
  }
  if (profile.role === "manager") {
    // Analytics uses can_view_payments as the gate (consistent with existing
    // analytics page feature flags) — can also rely on owner-only for now.
    const { data: manager } = await supabase
      .from("managers")
      .select("can_view_payments")
      .eq("profile_id", user.id)
      .eq("studio_id", profile.studio_id)
      .single();
    if (!manager?.can_view_payments) return null;
    return {
      supabase,
      studioId: profile.studio_id,
      userId: user.id,
      role: "manager" as const,
    };
  }
  return null;
}

export async function GET() {
  const ctx = await getAnalyticsContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await ctx.supabase
    .from("saved_reports")
    .select("*")
    .eq("studio_id", ctx.studioId)
    .order("is_favorite", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const ctx = await getAnalyticsContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  const body = await request.json();

  // --- Ad-hoc run (no save) ---
  if (action === "run") {
    const reportType = body.report_type as ReportType;
    const filters = (body.filters as ReportFilters) || {};
    if (!reportType) {
      return NextResponse.json({ error: "report_type required" }, { status: 400 });
    }
    try {
      const result = await runReport(ctx.supabase, ctx.studioId, reportType, filters);
      return NextResponse.json(result);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to run report" },
        { status: 500 }
      );
    }
  }

  // --- Save a new report ---
  const name: string | undefined = body.name;
  const reportType: ReportType | undefined = body.report_type;
  const filters: ReportFilters = body.filters || {};
  const description: string | undefined = body.description;

  if (!name?.trim() || !reportType) {
    return NextResponse.json(
      { error: "name and report_type are required" },
      { status: 400 }
    );
  }

  const { data, error } = await ctx.supabase
    .from("saved_reports")
    .insert({
      studio_id: ctx.studioId,
      name: name.trim(),
      description: description?.trim() || null,
      report_type: reportType,
      filters,
      created_by: ctx.userId,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
