import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PUT(request: Request) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "owner" || !profile?.studio_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { studioId, drop_in_price, pack_5_price, pack_10_price, monthly_price } = body;

    if (typeof studioId !== "string" || studioId !== profile.studio_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updates: Record<string, number> = {};
    if (typeof drop_in_price === "number" && drop_in_price >= 0)
      updates.drop_in_price = drop_in_price;
    if (typeof pack_5_price === "number" && pack_5_price >= 0)
      updates.pack_5_price = pack_5_price;
    if (typeof pack_10_price === "number" && pack_10_price >= 0)
      updates.pack_10_price = pack_10_price;
    if (typeof monthly_price === "number" && monthly_price >= 0)
      updates.monthly_price = monthly_price;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid prices" }, { status: 400 });
    }

    const { error } = await adminSupabase
      .from("studios")
      .update(updates)
      .eq("id", studioId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
