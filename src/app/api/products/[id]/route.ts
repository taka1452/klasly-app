import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type ProfileRow = { studio_id: string | null; role: string };

/** Minimal type to avoid SupabaseClient generic mismatch with createClient() return type */
type SupabaseLike = {
  from: (table: string) => {
    select: (...columns: string[]) => {
      eq: (column: string, value: string) => { single: () => Promise<{ data: unknown }> };
    };
  };
};

async function getOwnerStudioId(
  adminSupabase: SupabaseLike,
  userId: string
): Promise<string | null> {
  const { data } = await adminSupabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", userId)
    .single();
  const profile = data as ProfileRow | null;
  if (profile?.role !== "owner" || !profile?.studio_id) return null;
  return profile.studio_id;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
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

    const studioId = await getOwnerStudioId(adminSupabase, user.id);
    if (!studioId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: product, error } = await adminSupabase
      .from("products")
      .select("*")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (error || !product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(product);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
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

    const studioId = await getOwnerStudioId(adminSupabase, user.id);
    if (!studioId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: existing } = await adminSupabase
      .from("products")
      .select("id, type")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    const currentType = (existing as { type?: string }).type ?? "one_time";

    const body = await request.json();
    const {
      name,
      type,
      credits,
      price,
      billing_interval,
      description,
      sort_order,
      is_active,
    } = body;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof name === "string") {
      const t = name.trim();
      if (t.length === 0 || t.length > 100) {
        return NextResponse.json(
          { error: "name must be 1-100 characters" },
          { status: 400 }
        );
      }
      updates.name = t;
    }
    if (type === "one_time" || type === "subscription") {
      updates.type = type;
    }
    const effectiveType = type === "one_time" || type === "subscription" ? type : currentType;
    if (typeof credits === "number") {
      if (effectiveType === "one_time" && credits === -1) {
        return NextResponse.json(
          { error: "Unlimited credits (-1) is only allowed for subscription" },
          { status: 400 }
        );
      }
      updates.credits = credits;
    }
    if (typeof price === "number" && price >= 1) {
      updates.price = price;
    }
    if (billing_interval !== undefined) {
      updates.billing_interval =
        effectiveType === "subscription"
          ? (billing_interval === "year" ? "year" : "month")
          : null;
    }
    if (description !== undefined) {
      updates.description =
        typeof description === "string" ? description.trim() || null : null;
    }
    if (typeof sort_order === "number" && Number.isInteger(sort_order)) {
      updates.sort_order = sort_order;
    }
    if (typeof is_active === "boolean") {
      updates.is_active = is_active;
    }

    const { data: product, error } = await adminSupabase
      .from("products")
      .update(updates)
      .eq("id", id)
      .eq("studio_id", studioId)
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

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
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

    const studioId = await getOwnerStudioId(adminSupabase, user.id);
    if (!studioId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: product, error: updateError } = await adminSupabase
      .from("products")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("studio_id", studioId)
      .select()
      .single();

    if (updateError || !product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, product });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
