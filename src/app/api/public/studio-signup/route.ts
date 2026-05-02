import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin/supabase";

/**
 * GET /api/public/studio-signup?studioId=...
 *
 * Lightweight validation endpoint used by the public join page to
 * decide whether a studio's invite link should accept new signups.
 *
 * The actual auth.signUp call happens on the client (so the user picks
 * their own password and the confirmation email flow runs in the
 * standard Supabase way). After email confirmation, /auth/callback
 * reads `pending_studio_id` from user_metadata and creates the member
 * record server-side.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const studioId = url.searchParams.get("studioId")?.trim() ?? "";

  if (!studioId) {
    return NextResponse.json({ error: "studioId is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: studio } = await admin
    .from("studios")
    .select("id, name, plan_status, is_demo, max_members")
    .eq("id", studioId)
    .maybeSingle();

  if (!studio) {
    return NextResponse.json({ error: "Studio not found" }, { status: 404 });
  }

  if (studio.is_demo) {
    return NextResponse.json(
      {
        accepting: false,
        reason: "This studio is in demo mode and does not accept signups.",
      },
      { status: 200 }
    );
  }

  const acceptedStatuses = new Set(["active", "trial", "trialing", null]);
  if (
    studio.plan_status !== null &&
    !acceptedStatuses.has(studio.plan_status as string)
  ) {
    return NextResponse.json(
      {
        accepting: false,
        reason: "This studio is not currently accepting new members.",
      },
      { status: 200 }
    );
  }

  if (studio.max_members && studio.max_members > 0) {
    const { count } = await admin
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studioId);
    if ((count ?? 0) >= studio.max_members) {
      return NextResponse.json(
        {
          accepting: false,
          reason:
            "This studio has reached its member capacity. Please contact the studio.",
        },
        { status: 200 }
      );
    }
  }

  return NextResponse.json({
    accepting: true,
    studio: { id: studio.id, name: studio.name },
  });
}
