import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

/**
 * Studio library memberships — the member-side paid subscription that
 * unlocks library content. Admin CRUD endpoints.
 *
 *   GET  /api/library/memberships               — list memberships
 *   POST /api/library/memberships               — enroll a member manually
 *   PATCH /api/library/memberships?id=...       — change tier/status
 *   DELETE /api/library/memberships?id=...      — cancel immediately
 *
 * Enrollment via Stripe Checkout is handled in a separate stripe webhook
 * integration (out of scope for this first-pass UI).
 */
async function getAdminContext() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) return null;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.studio_id) return null;
  if (profile.role === "owner") return { supabase, studioId: profile.studio_id };
  if (profile.role === "manager") {
    const { data: manager } = await supabase
      .from("managers")
      .select("can_manage_members, can_manage_settings")
      .eq("profile_id", user.id)
      .eq("studio_id", profile.studio_id)
      .single();
    if (!manager?.can_manage_members && !manager?.can_manage_settings) return null;
    return { supabase, studioId: profile.studio_id };
  }
  return null;
}

export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await ctx.supabase
    .from("library_memberships")
    .select("*, members(id, profile_id, profiles(full_name, email))")
    .eq("studio_id", ctx.studioId)
    .order("started_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []).map((row) => {
    const mem = row.members as unknown;
    const m = (Array.isArray(mem) ? mem[0] : mem) as
      | { profile_id?: string; profiles?: { full_name?: string; email?: string } }
      | null;
    const prof = Array.isArray(m?.profiles) ? m?.profiles[0] : m?.profiles;
    return {
      ...row,
      member_name: (prof as { full_name?: string } | null)?.full_name ?? "Member",
      member_email: (prof as { email?: string } | null)?.email ?? "",
    };
  });
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const memberId = body.member_id as string | undefined;
  const tier = (body.tier as string) || "basic";
  const priceCents = typeof body.price_cents === "number" ? body.price_cents : null;

  if (!memberId) {
    return NextResponse.json({ error: "member_id required" }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from("library_memberships")
    .upsert(
      {
        studio_id: ctx.studioId,
        member_id: memberId,
        tier,
        price_cents: priceCents,
        status: "active",
      },
      { onConflict: "studio_id,member_id" }
    )
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (body.tier !== undefined) updates.tier = body.tier;
  if (body.status !== undefined) updates.status = body.status;
  if (body.price_cents !== undefined) updates.price_cents = body.price_cents;
  if (body.status === "cancelled") updates.cancelled_at = new Date().toISOString();

  const { data, error } = await ctx.supabase
    .from("library_memberships")
    .update(updates)
    .eq("id", id)
    .eq("studio_id", ctx.studioId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await ctx.supabase
    .from("library_memberships")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", id)
    .eq("studio_id", ctx.studioId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
