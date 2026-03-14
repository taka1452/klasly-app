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

// GET: list all tiers
export async function GET() {
  try {
    const ctx = await getOwnerContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await ctx.supabase
      .from("instructor_membership_tiers")
      .select("*")
      .eq("studio_id", ctx.studioId)
      .order("sort_order", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: create tier
export async function POST(request: Request) {
  try {
    const ctx = await getOwnerContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { name, monthly_minutes, monthly_price, sort_order } = body;

    if (!name || monthly_minutes === undefined) {
      return NextResponse.json({ error: "name and monthly_minutes are required" }, { status: 400 });
    }

    const { data, error } = await ctx.supabase
      .from("instructor_membership_tiers")
      .insert({
        studio_id: ctx.studioId,
        name,
        monthly_minutes,
        monthly_price: monthly_price || 0,
        sort_order: sort_order || 0,
        is_active: true,
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH: update tier
export async function PATCH(request: Request) {
  try {
    const ctx = await getOwnerContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const { data, error } = await ctx.supabase
      .from("instructor_membership_tiers")
      .update(updates)
      .eq("id", id)
      .eq("studio_id", ctx.studioId)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
