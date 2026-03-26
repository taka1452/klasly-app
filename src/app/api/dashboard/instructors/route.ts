import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { NextResponse } from "next/server";

/**
 * GET /api/dashboard/instructors
 * List active instructors for the studio (owner/manager).
 */
export async function GET() {
  const ctx = await getDashboardContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await ctx.supabase
    .from("instructors")
    .select("id, profiles(full_name)")
    .eq("studio_id", ctx.studioId)
    .eq("is_active", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const instructors = (data || []).map(
    (i: { id: string; profiles: { full_name: string } | { full_name: string }[] | null }) => {
      const p = Array.isArray(i.profiles) ? i.profiles[0] : i.profiles;
      return {
        id: i.id,
        name: p?.full_name || "Unknown",
      };
    }
  );

  return NextResponse.json(instructors);
}
