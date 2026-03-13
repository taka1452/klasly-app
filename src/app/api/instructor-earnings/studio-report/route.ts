import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

    // Get all earnings for the studio in this month
    const { data: earnings } = await adminSupabase
      .from("instructor_earnings")
      .select(
        "instructor_id, gross_amount, stripe_fee, platform_fee, studio_fee, instructor_payout"
      )
      .eq("studio_id", profile.studio_id)
      .gte("created_at", startDate)
      .lt("created_at", endDate);

    // Get instructor names
    const { data: instructors } = await adminSupabase
      .from("instructors")
      .select("id, profiles(full_name, email)")
      .eq("studio_id", profile.studio_id);

    const instructorMap = new Map<
      string,
      { name: string; email: string }
    >();
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
    const aggregated = new Map<
      string,
      {
        instructorId: string;
        name: string;
        email: string;
        classCount: number;
        totalGross: number;
        totalStudioFee: number;
        totalPlatformFee: number;
        totalInstructorPayout: number;
      }
    >();

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
          instructorId: e.instructor_id,
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

    const totals = {
      totalGross: report.reduce((s, r) => s + r.totalGross, 0),
      totalStudioFee: report.reduce((s, r) => s + r.totalStudioFee, 0),
      totalPlatformFee: report.reduce((s, r) => s + r.totalPlatformFee, 0),
      totalInstructorPayout: report.reduce(
        (s, r) => s + r.totalInstructorPayout,
        0
      ),
      totalClasses: report.reduce((s, r) => s + r.classCount, 0),
    };

    return NextResponse.json({ report, totals });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
