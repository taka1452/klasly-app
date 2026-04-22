import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/account/profile
 * Returns the current user's profile (available to all roles).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, avatar_url, role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...profile,
    auth_email: user.email ?? null,
  });
}

/**
 * PATCH /api/account/profile
 * Updates the current user's full_name and/or phone.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};

  if (typeof body.full_name === "string") {
    const trimmed = body.full_name.trim();
    if (trimmed.length === 0 || trimmed.length > 120) {
      return NextResponse.json(
        { error: "Name must be between 1 and 120 characters" },
        { status: 400 }
      );
    }
    updates.full_name = trimmed;
  }

  if (body.phone === null || typeof body.phone === "string") {
    updates.phone = body.phone ? String(body.phone).trim().slice(0, 30) : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, updates });
}
