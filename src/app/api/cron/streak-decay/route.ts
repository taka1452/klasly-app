import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Daily streak decay. Any member whose last_attended_week is older than
 * the previous week (i.e. they missed *both* this week and last week)
 * has their current_streak_weeks reset to 0. The longest_streak_weeks
 * field is preserved so members can chase their personal best.
 *
 * Idempotent — running multiple times in a day produces the same state.
 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminDb = createAdminClient();

  // Compute "last week's Monday" in UTC
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayOfWeek = today.getUTCDay(); // 0 = Sun
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const thisMonday = new Date(today);
  thisMonday.setUTCDate(today.getUTCDate() - daysSinceMonday);
  const lastMonday = new Date(thisMonday);
  lastMonday.setUTCDate(thisMonday.getUTCDate() - 7);
  const lastMondayIso = lastMonday.toISOString().slice(0, 10);

  const { data, error } = await adminDb
    .from("members")
    .update({ current_streak_weeks: 0 })
    .lt("last_attended_week", lastMondayIso)
    .gt("current_streak_weeks", 0)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    decayed: data?.length ?? 0,
    cutoff: lastMondayIso,
  });
}
