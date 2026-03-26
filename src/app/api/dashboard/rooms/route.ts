import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { NextResponse } from "next/server";

/**
 * GET /api/dashboard/rooms
 * List active rooms for the studio (owner/manager).
 */
export async function GET() {
  const ctx = await getDashboardContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await ctx.supabase
    .from("rooms")
    .select("id, name")
    .eq("studio_id", ctx.studioId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
