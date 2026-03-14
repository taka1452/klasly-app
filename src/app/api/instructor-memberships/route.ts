import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function getOwnerContext() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) return null;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
    : serverSupabase;

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id || profile.role !== "owner") return null;

  return { supabase, studioId: profile.studio_id };
}

// GET: list all instructor memberships for studio
export async function GET() {
  try {
    const ctx = await getOwnerContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await ctx.supabase
      .from("instructor_memberships")
      .select("*, instructor_membership_tiers(name, monthly_minutes)")
      .eq("studio_id", ctx.studioId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: assign tier to instructor
export async function POST(request: Request) {
  try {
    const ctx = await getOwnerContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { instructor_id, tier_id } = body;

    if (!instructor_id || !tier_id) {
      return NextResponse.json(
        { error: "instructor_id and tier_id are required" },
        { status: 400 }
      );
    }

    // Verify instructor belongs to this studio
    const { data: instructor } = await ctx.supabase
      .from("instructors")
      .select("id, studio_id")
      .eq("id", instructor_id)
      .single();

    if (!instructor || instructor.studio_id !== ctx.studioId) {
      return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
    }

    // Verify tier belongs to this studio
    const { data: tier } = await ctx.supabase
      .from("instructor_membership_tiers")
      .select("id, studio_id")
      .eq("id", tier_id)
      .single();

    if (!tier || tier.studio_id !== ctx.studioId) {
      return NextResponse.json({ error: "Tier not found" }, { status: 404 });
    }

    // Upsert: if membership exists for this instructor, update tier
    const { data: existing } = await ctx.supabase
      .from("instructor_memberships")
      .select("id")
      .eq("instructor_id", instructor_id)
      .maybeSingle();

    let data, error;
    if (existing) {
      ({ data, error } = await ctx.supabase
        .from("instructor_memberships")
        .update({ tier_id, status: "active" })
        .eq("id", existing.id)
        .select("*")
        .single());
    } else {
      ({ data, error } = await ctx.supabase
        .from("instructor_memberships")
        .insert({
          studio_id: ctx.studioId,
          instructor_id,
          tier_id,
          status: "active",
        })
        .select("*")
        .single());
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: existing ? 200 : 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE: remove instructor membership
export async function DELETE(request: Request) {
  try {
    const ctx = await getOwnerContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const instructorId = searchParams.get("instructor_id");

    if (!instructorId) {
      return NextResponse.json({ error: "instructor_id is required" }, { status: 400 });
    }

    const { error } = await ctx.supabase
      .from("instructor_memberships")
      .update({ status: "cancelled" })
      .eq("instructor_id", instructorId)
      .eq("studio_id", ctx.studioId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
