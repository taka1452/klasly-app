import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * GET /api/instructor-earnings/tax-report/pdf?year=2025
 * 年間税務レポートPDF
 */
export async function GET(request: Request) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "owner" || !profile?.studio_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const enabled = await isFeatureEnabled(
      profile.studio_id,
      FEATURE_KEYS.TAX_REPORT
    );
    if (!enabled) {
      return NextResponse.json(
        { error: "Feature not enabled" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const year = parseInt(url.searchParams.get("year") || String(new Date().getFullYear()));

    // Get studio name
    const { data: studio } = await adminSupabase
      .from("studios")
      .select("name")
      .eq("id", profile.studio_id)
      .single();

    const studioName = studio?.name ?? "Studio";

    // Get earnings
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const { data: earnings } = await adminSupabase
      .from("instructor_earnings")
      .select("instructor_id, gross_amount, instructor_payout, studio_fee, platform_fee, stripe_fee")
      .eq("studio_id", profile.studio_id)
      .eq("status", "completed")
      .gte("created_at", startDate)
      .lte("created_at", `${endDate}T23:59:59`);

    const { data: instructors } = await adminSupabase
      .from("instructors")
      .select("id, profiles(full_name, email)")
      .eq("studio_id", profile.studio_id);

    const instructorMap = new Map(
      (instructors ?? []).map((i) => {
        const prof = Array.isArray(i.profiles) ? i.profiles[0] : i.profiles;
        return [
          i.id,
          {
            name: (prof as { full_name?: string })?.full_name ?? "Unknown",
            email: (prof as { email?: string })?.email ?? "",
          },
        ];
      })
    );

    // Aggregate
    const aggregated = new Map<string, {
      name: string;
      email: string;
      total_payout: number;
      total_gross: number;
      total_studio_fee: number;
      transaction_count: number;
    }>();

    for (const earning of earnings ?? []) {
      const info = instructorMap.get(earning.instructor_id) ?? { name: "Unknown", email: "" };
      const existing = aggregated.get(earning.instructor_id);
      if (existing) {
        existing.total_payout += earning.instructor_payout;
        existing.total_gross += earning.gross_amount;
        existing.total_studio_fee += earning.studio_fee;
        existing.transaction_count += 1;
      } else {
        aggregated.set(earning.instructor_id, {
          name: info.name,
          email: info.email,
          total_payout: earning.instructor_payout,
          total_gross: earning.gross_amount,
          total_studio_fee: earning.studio_fee,
          transaction_count: 1,
        });
      }
    }

    const rows = Array.from(aggregated.values()).sort((a, b) => b.total_payout - a.total_payout);
    const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

    // Generate PDF
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text(`${studioName} - Tax Report ${year}`, 14, 22);

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`1099-NEC Threshold: $600.00`, 14, 36);

    // Summary
    const totalPayout = rows.reduce((s, r) => s + r.total_payout, 0);
    const totalGross = rows.reduce((s, r) => s + r.total_gross, 0);
    const requiring1099 = rows.filter((r) => r.total_payout >= 60000).length;

    autoTable(doc, {
      startY: 42,
      head: [["Metric", "Value"]],
      body: [
        ["Total Gross Revenue", fmt(totalGross)],
        ["Total Instructor Payouts", fmt(totalPayout)],
        ["Instructors", String(rows.length)],
        ["Requiring 1099-NEC", String(requiring1099)],
      ],
      theme: "grid",
      headStyles: { fillColor: [0, 116, 197] },
    });

    const afterSummary = (doc as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 80;

    // Instructor detail table
    autoTable(doc, {
      startY: afterSummary + 10,
      head: [["Instructor", "Email", "Classes", "Total Payout", "1099?"]],
      body: rows.map((r) => [
        r.name,
        r.email,
        String(r.transaction_count),
        fmt(r.total_payout),
        r.total_payout >= 60000 ? "YES" : "No",
      ]),
      theme: "striped",
      headStyles: { fillColor: [0, 116, 197] },
      columnStyles: {
        3: { halign: "right" },
        4: { halign: "center" },
      },
    });

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="tax-report-${year}.pdf"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
