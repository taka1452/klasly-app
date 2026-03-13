import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/admin/supabase";

// ============================================================
// GET /api/instructor-earnings/rental-report?month=YYYY-MM
//   Returns monthly rental settlement report for the studio owner.
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminDb = createAdminClient();

    const { data: profile } = await adminDb
      .from("profiles")
      .select("role, studio_id")
      .eq("id", user.id)
      .single();

    if (!profile?.studio_id || profile.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse month parameter
    const monthParam = request.nextUrl.searchParams.get("month");
    const now = new Date();
    const month = monthParam || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const [yearStr, monthStr] = month.split("-");
    const year = parseInt(yearStr, 10);
    const mon = parseInt(monthStr, 10);

    // Date range for the month
    const startDate = `${year}-${String(mon).padStart(2, "0")}-01`;
    const endYear = mon === 12 ? year + 1 : year;
    const endMonth = mon === 12 ? 1 : mon + 1;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

    // Get all instructors with rental settings
    const { data: instructors } = await adminDb
      .from("instructors")
      .select("id, rental_type, rental_amount, profiles(full_name, email)")
      .eq("studio_id", profile.studio_id);

    if (!instructors || instructors.length === 0) {
      return NextResponse.json({ report: [], totals: { totalDue: 0, instructorCount: 0 } });
    }

    // Get class counts for per_class instructors
    // Find classes assigned to each instructor, then count sessions in the month
    const perClassInstructorIds = instructors
      .filter((i) => (i as { rental_type: string }).rental_type === "per_class")
      .map((i) => i.id);

    let sessionCounts: Record<string, number> = {};

    if (perClassInstructorIds.length > 0) {
      // Get classes for these instructors
      const { data: classes } = await adminDb
        .from("classes")
        .select("id, instructor_id")
        .eq("studio_id", profile.studio_id)
        .in("instructor_id", perClassInstructorIds);

      if (classes && classes.length > 0) {
        const classIds = classes.map((c) => c.id);

        // Count sessions per class in the month
        const { data: sessions } = await adminDb
          .from("class_sessions")
          .select("id, class_id")
          .in("class_id", classIds)
          .gte("session_date", startDate)
          .lt("session_date", endDate)
          .eq("is_cancelled", false);

        if (sessions) {
          // Map class_id → instructor_id
          const classToInstructor: Record<string, string> = {};
          for (const cls of classes) {
            classToInstructor[cls.id] = cls.instructor_id;
          }

          // Count sessions per instructor
          for (const session of sessions) {
            const instId = classToInstructor[session.class_id];
            if (instId) {
              sessionCounts[instId] = (sessionCounts[instId] || 0) + 1;
            }
          }
        }
      }
    }

    // Build report
    type ReportItem = {
      instructorId: string;
      name: string;
      email: string;
      rentalType: string;
      rentalAmount: number;
      classCount: number;
      totalDue: number;
    };

    const report: ReportItem[] = [];
    let totalDue = 0;
    let instructorCount = 0;

    for (const inst of instructors) {
      const rental = inst as {
        id: string;
        rental_type: string;
        rental_amount: number;
        profiles: { full_name?: string; email?: string } | { full_name?: string; email?: string }[] | null;
      };

      if (rental.rental_type === "none") continue;

      const profileData = Array.isArray(rental.profiles)
        ? rental.profiles[0]
        : rental.profiles;

      let classCount = 0;
      let due = 0;

      if (rental.rental_type === "flat_monthly") {
        due = rental.rental_amount;
      } else if (rental.rental_type === "per_class") {
        classCount = sessionCounts[rental.id] || 0;
        due = classCount * rental.rental_amount;
      }

      if (due > 0 || rental.rental_type === "flat_monthly") {
        report.push({
          instructorId: rental.id,
          name: profileData?.full_name || "Unknown",
          email: profileData?.email || "",
          rentalType: rental.rental_type,
          rentalAmount: rental.rental_amount,
          classCount,
          totalDue: due,
        });
        totalDue += due;
        instructorCount++;
      }
    }

    return NextResponse.json({
      report,
      totals: { totalDue, instructorCount },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
