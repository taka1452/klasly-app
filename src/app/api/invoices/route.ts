import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  parseMonthPeriod,
  computeInvoiceBreakdown,
  saveDraftInvoice,
} from "@/lib/invoices/generate-monthly";

/**
 * Monthly instructor invoice list + bulk-generate endpoint.
 *
 * GET  /api/invoices?month=YYYY-MM[&instructor_id=...][&status=...]
 * POST /api/invoices?action=generate  body: { month, instructorIds? }
 *   — bulk-generates DRAFT invoices for the given month. Upserts by
 *     (studio, instructor, period). Owners can re-run safely.
 *
 * Jamie feedback 2026-04: "Can we set up contracts by month and invoice
 * them monthly?"
 */
async function getAdminContext() {
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
    const { data: manager } = await supabase
      .from("managers")
      .select("can_manage_contracts_tiers, can_view_payments")
      .eq("profile_id", user.id)
      .eq("studio_id", profile.studio_id)
      .single();
    // Managing invoices requires either contracts/tiers OR payments perm.
    if (!manager?.can_manage_contracts_tiers && !manager?.can_view_payments) {
      return null;
    }
    return {
      supabase,
      studioId: profile.studio_id,
      userId: user.id,
      role: "manager" as const,
    };
  }
  return null;
}

export async function GET(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const instructorId = searchParams.get("instructor_id");
  const status = searchParams.get("status");

  let query = ctx.supabase
    .from("instructor_invoices")
    .select(
      "*, instructors(id, profile_id, profiles(full_name, email))"
    )
    .eq("studio_id", ctx.studioId)
    .order("period_start", { ascending: false });

  if (month) {
    const p = parseMonthPeriod(month);
    query = query.eq("period_start", p.periodStart);
  }
  if (instructorId) query = query.eq("instructor_id", instructorId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const invoices = (data || []).map((row) => {
    const instr = row.instructors as unknown;
    const instrRec = (Array.isArray(instr) ? instr[0] : instr) as
      | { profile_id?: string; profiles?: { full_name?: string; email?: string } }
      | null;
    const prof = Array.isArray(instrRec?.profiles)
      ? instrRec!.profiles[0]
      : instrRec?.profiles;
    return {
      ...row,
      instructor_name: (prof as { full_name?: string } | null)?.full_name ?? "Instructor",
      instructor_email: (prof as { email?: string } | null)?.email ?? "",
    };
  });

  return NextResponse.json(invoices);
}

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "generate") {
    const body = await request.json();
    const month: string | undefined = body.month;
    const providedIds: string[] | undefined = body.instructorIds;

    if (!month) {
      return NextResponse.json({ error: "month is required" }, { status: 400 });
    }

    const period = parseMonthPeriod(month);

    // Decide which instructors to generate for.
    let instructorIds = providedIds || [];
    if (instructorIds.length === 0) {
      const { data: instructors } = await ctx.supabase
        .from("instructors")
        .select("id")
        .eq("studio_id", ctx.studioId);
      instructorIds = (instructors || []).map((i) => i.id as string);
    }

    const results: Array<{ instructor_id: string; invoice_id?: string; error?: string }> = [];

    for (const instructorId of instructorIds) {
      try {
        const breakdown = await computeInvoiceBreakdown(
          ctx.supabase,
          ctx.studioId,
          instructorId,
          period
        );

        // Skip empty invoices (no charges + no overage + no flat fees).
        if (breakdown.totalCents === 0 && breakdown.sessionCount === 0) {
          results.push({ instructor_id: instructorId, error: "no charges this period" });
          continue;
        }

        const saved = await saveDraftInvoice(ctx.supabase, breakdown, ctx.userId);
        results.push({ instructor_id: instructorId, invoice_id: saved.id as string });
      } catch (err) {
        results.push({
          instructor_id: instructorId,
          error: err instanceof Error ? err.message : "unknown error",
        });
      }
    }

    return NextResponse.json({
      period,
      generated: results.filter((r) => r.invoice_id).length,
      skipped: results.filter((r) => r.error).length,
      results,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
