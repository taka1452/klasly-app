import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export const runtime = "nodejs";

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

    // Parse month filter
    const url = new URL(request.url);
    const monthParam = url.searchParams.get("month");
    const now = new Date();
    const year = monthParam
      ? parseInt(monthParam.split("-")[0], 10)
      : now.getFullYear();
    const month = monthParam
      ? parseInt(monthParam.split("-")[1], 10)
      : now.getMonth() + 1;

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate =
      month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const monthLabel = `${monthNames[month - 1]} ${year}`;

    // Get studio name
    const { data: studio } = await adminSupabase
      .from("studios")
      .select("name")
      .eq("id", profile.studio_id)
      .single();

    const studioName = studio?.name ?? "Studio";

    // Get all earnings for the studio in this month
    const { data: earnings } = await adminSupabase
      .from("instructor_earnings")
      .select(
        "instructor_id, gross_amount, stripe_fee, platform_fee, studio_fee, instructor_payout, fee_type, fee_source"
      )
      .eq("studio_id", profile.studio_id)
      .gte("created_at", startDate)
      .lt("created_at", endDate);

    // Get instructor names
    const { data: instructors } = await adminSupabase
      .from("instructors")
      .select("id, profiles(full_name, email)")
      .eq("studio_id", profile.studio_id);

    const instructorMap = new Map<string, { name: string; email: string }>();
    for (const inst of instructors ?? []) {
      const prof = Array.isArray(inst.profiles)
        ? inst.profiles[0]
        : inst.profiles;
      instructorMap.set(inst.id, {
        name: (prof as { full_name?: string })?.full_name ?? "Unknown",
        email: (prof as { email?: string })?.email ?? "",
      });
    }

    // Aggregate per instructor
    type InstructorAgg = {
      name: string;
      email: string;
      classCount: number;
      totalGross: number;
      totalStudioFee: number;
      totalPlatformFee: number;
      totalInstructorPayout: number;
    };

    const aggregated = new Map<string, InstructorAgg>();

    for (const e of earnings ?? []) {
      const existing = aggregated.get(e.instructor_id);
      const info = instructorMap.get(e.instructor_id) ?? {
        name: "Unknown",
        email: "",
      };

      if (existing) {
        existing.classCount += 1;
        existing.totalGross += e.gross_amount;
        existing.totalStudioFee += e.studio_fee;
        existing.totalPlatformFee += e.platform_fee;
        existing.totalInstructorPayout += e.instructor_payout;
      } else {
        aggregated.set(e.instructor_id, {
          name: info.name,
          email: info.email,
          classCount: 1,
          totalGross: e.gross_amount,
          totalStudioFee: e.studio_fee,
          totalPlatformFee: e.platform_fee,
          totalInstructorPayout: e.instructor_payout,
        });
      }
    }

    const report = Array.from(aggregated.values());
    const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

    // Build PDF
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.setTextColor(0, 116, 197); // Brand blue
    doc.text(studioName, 14, 22);

    doc.setFontSize(14);
    doc.setTextColor(60, 60, 60);
    doc.text(`Instructor Earnings Report — ${monthLabel}`, 14, 32);

    doc.setFontSize(9);
    doc.setTextColor(140, 140, 140);
    doc.text(`Generated: ${new Date().toLocaleString("en-US")}`, 14, 38);

    // Summary table
    const totalGross = report.reduce((s, r) => s + r.totalGross, 0);
    const totalStudioFee = report.reduce((s, r) => s + r.totalStudioFee, 0);
    const totalPlatformFee = report.reduce(
      (s, r) => s + r.totalPlatformFee,
      0
    );
    const totalPayout = report.reduce(
      (s, r) => s + r.totalInstructorPayout,
      0
    );
    const totalClasses = report.reduce((s, r) => s + r.classCount, 0);

    autoTable(doc, {
      startY: 44,
      head: [["Summary", "Value"]],
      body: [
        ["Total Revenue", fmt(totalGross)],
        ["Total Studio Fees", fmt(totalStudioFee)],
        ["Total Platform Fees", fmt(totalPlatformFee)],
        ["Total Instructor Payouts", fmt(totalPayout)],
        ["Total Classes", String(totalClasses)],
        ["Instructors", String(report.length)],
      ],
      theme: "grid",
      headStyles: { fillColor: [0, 116, 197], textColor: 255, fontSize: 10 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 1: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });

    // Instructor breakdown table
    if (report.length > 0) {
      const lastY =
        (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
          ?.finalY ?? 100;

      doc.setFontSize(12);
      doc.setTextColor(60, 60, 60);
      doc.text("Instructor Breakdown", 14, lastY + 12);

      autoTable(doc, {
        startY: lastY + 16,
        head: [
          [
            "Instructor",
            "Classes",
            "Revenue",
            "Studio Fee",
            "Platform Fee",
            "Payout",
          ],
        ],
        body: report.map((r) => [
          r.name,
          String(r.classCount),
          fmt(r.totalGross),
          fmt(r.totalStudioFee),
          fmt(r.totalPlatformFee),
          fmt(r.totalInstructorPayout),
        ]),
        theme: "grid",
        headStyles: {
          fillColor: [0, 116, 197],
          textColor: 255,
          fontSize: 9,
        },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          1: { halign: "center" },
          2: { halign: "right" },
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" },
        },
        margin: { left: 14, right: 14 },
      });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(180, 180, 180);
      doc.text(
        `Klasly — ${studioName} — Page ${i} of ${pageCount}`,
        14,
        doc.internal.pageSize.height - 10
      );
    }

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    const filename = `earnings-report-${year}-${String(month).padStart(2, "0")}.pdf`;

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
