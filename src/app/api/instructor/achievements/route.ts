import { getInstructorContext } from "@/lib/auth/instructor-access";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import { checkAndAwardInstructorAchievements } from "@/lib/achievements/instructor-compute";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const ctx = await getInstructorContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const enabled = await isFeatureEnabled(
      ctx.studioId,
      FEATURE_KEYS.INSTRUCTOR_ACHIEVEMENTS
    );
    if (!enabled) {
      return NextResponse.json({ achievements: [] });
    }

    // Check and award any new achievements
    await checkAndAwardInstructorAchievements(
      ctx.supabase,
      ctx.instructorId,
      ctx.studioId
    ).catch(() => {});

    const { data: achievements } = await ctx.supabase
      .from("instructor_achievements")
      .select("id, achievement_type, earned_at, metadata")
      .eq("instructor_id", ctx.instructorId)
      .order("earned_at", { ascending: true });

    return NextResponse.json({ achievements: achievements || [] });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
