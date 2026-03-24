import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active");

    let query = adminSupabase
      .from("products")
      .select("*")
      .eq("studio_id", profile.studio_id)
      .order("sort_order", { ascending: true });

    if (activeOnly === "true") {
      query = query.eq("is_active", true);
    }

    const { data: products, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(products ?? []);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

    // スタジオの通貨設定を取得
    const { data: studioRow } = await adminSupabase
      .from("studios")
      .select("currency")
      .eq("id", profile.studio_id)
      .single();
    const studioCurrency = (studioRow?.currency ?? "usd").toLowerCase();

    const body = await request.json();
    const {
      name,
      type,
      credits,
      price,
      currency = studioCurrency,
      billing_interval,
      description,
      sort_order: bodySortOrder,
    } = body;

    // Validation
    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "name is required (1-100 characters)" },
        { status: 400 }
      );
    }
    const nameTrimmed = name.trim();
    if (nameTrimmed.length > 100) {
      return NextResponse.json(
        { error: "name must be 1-100 characters" },
        { status: 400 }
      );
    }

    if (type !== "one_time" && type !== "subscription") {
      return NextResponse.json(
        { error: "type must be one_time or subscription" },
        { status: 400 }
      );
    }

    const creditsNum = typeof credits === "number" ? credits : parseInt(String(credits), 10);
    if (Number.isNaN(creditsNum)) {
      return NextResponse.json(
        { error: "credits is required" },
        { status: 400 }
      );
    }
    if (type === "one_time" && creditsNum === -1) {
      return NextResponse.json(
        { error: "Unlimited credits (-1) is only allowed for subscription type" },
        { status: 400 }
      );
    }

    if (typeof price !== "number" || price < 1) {
      return NextResponse.json(
        { error: "price is required and must be at least 1 (cents)" },
        { status: 400 }
      );
    }

    if (type === "subscription") {
      if (billing_interval !== "month" && billing_interval !== "year") {
        return NextResponse.json(
          { error: "billing_interval is required for subscription (month or year)" },
          { status: 400 }
        );
      }
    } else if (billing_interval != null) {
      return NextResponse.json(
        { error: "billing_interval should be null for one_time" },
        { status: 400 }
      );
    }

    let sortOrder: number;
    if (typeof bodySortOrder === "number" && Number.isInteger(bodySortOrder)) {
      sortOrder = bodySortOrder;
    } else {
      const { data: maxRow } = await adminSupabase
        .from("products")
        .select("sort_order")
        .eq("studio_id", profile.studio_id)
        .order("sort_order", { ascending: false })
        .limit(1)
        .single();
      sortOrder = (maxRow?.sort_order ?? -1) + 1;
    }

    const { data: product, error } = await adminSupabase
      .from("products")
      .insert({
        studio_id: profile.studio_id,
        name: nameTrimmed,
        type,
        credits: creditsNum,
        price,
        currency: typeof currency === "string" ? currency : "usd",
        billing_interval: type === "subscription" ? billing_interval : null,
        description: typeof description === "string" ? description.trim() || null : null,
        is_active: true,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(product);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
