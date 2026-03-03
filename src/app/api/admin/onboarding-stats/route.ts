import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";

export async function GET() {
  try {
    await requireAdmin();
    const supabase = createAdminClient();

    const { count: totalStarted } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .not("onboarding_started_at", "is", null);

    const { count: totalCompleted } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("onboarding_completed", true);

    const { count: dropOffCount } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .not("onboarding_started_at", "is", null)
      .eq("onboarding_completed", false);

    const started = totalStarted ?? 0;
    const completed = totalCompleted ?? 0;
    const completionRate =
      started > 0 ? Math.round((completed / started) * 100) : 0;

    const { data: completedProfiles } = await supabase
      .from("profiles")
      .select("onboarding_started_at, onboarding_completed_at")
      .eq("onboarding_completed", true)
      .not("onboarding_started_at", "is", null)
      .not("onboarding_completed_at", "is", null);

    let avgMinutes = 0;
    if (completedProfiles && completedProfiles.length > 0) {
      const times = completedProfiles
        .map((p) => {
          const start = p.onboarding_started_at;
          const end = p.onboarding_completed_at;
          if (!start || !end) return null;
          const diff =
            new Date(end).getTime() - new Date(start).getTime();
          return diff / (1000 * 60);
        })
        .filter((m): m is number => m !== null && m >= 0);
      if (times.length > 0) {
        avgMinutes = Math.round(
          times.reduce((a, b) => a + b, 0) / times.length
        );
      }
    }

    return NextResponse.json({
      totalStarted: started,
      totalCompleted: completed,
      completionRate,
      avgCompletionMinutes: avgMinutes,
      dropOffCount: dropOffCount ?? 0,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 404 });
  }
}
