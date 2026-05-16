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

    if (!profile?.studio_id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (profile.role === "manager") {
      const { data: mgr } = await adminDb
        .from("managers")
        .select("can_manage_contracts_tiers, can_manage_settings")
        .eq("profile_id", user.id)
        .eq("studio_id", profile.studio_id)
        .single();
      if (!mgr?.can_manage_contracts_tiers && !mgr?.can_manage_settings) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (profile.role !== "owner") {
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

    // Per-class / per-hour both need session-level data for the month.
    // Per-class counts sessions; per-hour sums duration_minutes from
    // class_sessions *plus* the duration of any non-cancelled
    // instructor_room_bookings (ad-hoc room rentals don't go through
    // class_sessions but the renter should still be billed for them).
    const usageInstructorIds = instructors
      .filter((i) => {
        const t = (i as { rental_type: string }).rental_type;
        return t === "per_class" || t === "per_hour";
      })
      .map((i) => i.id);

    const perHourInstructorIds = instructors
      .filter((i) => (i as { rental_type: string }).rental_type === "per_hour")
      .map((i) => i.id);

    const sessionCounts: Record<string, number> = {};
    const sessionMinutes: Record<string, number> = {};

    if (usageInstructorIds.length > 0) {
      // Get classes for these instructors (both legacy and templates)
      const [{ data: legacyClasses }, { data: templateClasses }] = await Promise.all([
        adminDb
          .from("classes")
          .select("id, instructor_id")
          .eq("studio_id", profile.studio_id)
          .in("instructor_id", usageInstructorIds),
        adminDb
          .from("class_templates")
          .select("id, instructor_id")
          .eq("studio_id", profile.studio_id)
          .in("instructor_id", usageInstructorIds),
      ]);
      const classes = [...(legacyClasses ?? []), ...(templateClasses ?? [])];

      if (classes.length > 0) {
        const classIds = classes.map((c) => c.id);

        // Pull session count + duration for the month
        const { data: sessions } = await adminDb
          .from("class_sessions")
          .select("id, class_id, duration_minutes")
          .in("class_id", classIds)
          .gte("session_date", startDate)
          .lt("session_date", endDate)
          .eq("is_cancelled", false);

        if (sessions) {
          const classToInstructor: Record<string, string> = {};
          for (const cls of classes) {
            classToInstructor[cls.id] = cls.instructor_id;
          }

          for (const session of sessions) {
            const instId = classToInstructor[session.class_id];
            if (!instId) continue;
            sessionCounts[instId] = (sessionCounts[instId] || 0) + 1;
            sessionMinutes[instId] =
              (sessionMinutes[instId] || 0) + (session.duration_minutes ?? 0);
          }
        }
      }
    }

    // Add room-only bookings into the per_hour totals. The room booking
    // table stores start/end times (no duration column), so compute the
    // diff in JS — small N, no need for SQL math.
    if (perHourInstructorIds.length > 0) {
      const { data: roomBookings } = await adminDb
        .from("instructor_room_bookings")
        .select("instructor_id, start_time, end_time, status")
        .eq("studio_id", profile.studio_id)
        .in("instructor_id", perHourInstructorIds)
        .gte("booking_date", startDate)
        .lt("booking_date", endDate);
      if (roomBookings) {
        for (const rb of roomBookings) {
          // Drop cancelled / pending if those are ever introduced; today
          // the table doesn't enforce a status enum so be conservative.
          if (rb.status && /cancel|reject|declin/i.test(rb.status)) continue;
          const [sH, sM] = (rb.start_time as string).split(":").map(Number);
          const [eH, eM] = (rb.end_time as string).split(":").map(Number);
          const minutes = Math.max(0, eH * 60 + eM - (sH * 60 + sM));
          sessionMinutes[rb.instructor_id] =
            (sessionMinutes[rb.instructor_id] || 0) + minutes;
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
      hoursBilled: number;
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
      let hoursBilled = 0;
      let due = 0;

      if (rental.rental_type === "flat_monthly") {
        due = rental.rental_amount;
      } else if (rental.rental_type === "per_class") {
        classCount = sessionCounts[rental.id] || 0;
        due = classCount * rental.rental_amount;
      } else if (rental.rental_type === "per_hour") {
        const minutes = sessionMinutes[rental.id] || 0;
        // Round to two decimals to keep the report readable; the actual
        // due amount stays exact at the cent level.
        hoursBilled = Math.round((minutes / 60) * 100) / 100;
        due = Math.round((minutes / 60) * rental.rental_amount);
      }

      if (due > 0 || rental.rental_type === "flat_monthly") {
        report.push({
          instructorId: rental.id,
          name: profileData?.full_name || "Unknown",
          email: profileData?.email || "",
          rentalType: rental.rental_type,
          rentalAmount: rental.rental_amount,
          classCount,
          hoursBilled,
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
