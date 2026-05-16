import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { NextResponse } from "next/server";

/**
 * GET /api/discount-codes — list all codes for the current studio.
 * POST /api/discount-codes — create a new code.
 * Owner + Manager (settings perm) only.
 */
export async function GET() {
  const ctx = await getDashboardContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role === "manager" && !ctx.permissions?.can_manage_settings) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await ctx.supabase
    .from("studio_discount_codes")
    .select("*")
    .eq("studio_id", ctx.studioId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const ctx = await getDashboardContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role === "manager" && !ctx.permissions?.can_manage_settings) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const {
    code,
    description,
    discount_type,
    discount_value,
    scope,
    member_tag,
    expires_at,
    usage_limit,
    one_time_per_member,
    is_active,
  } = body as Record<string, unknown>;

  if (typeof code !== "string" || !code.trim()) {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }
  if (discount_type !== "percent" && discount_type !== "fixed") {
    return NextResponse.json(
      { error: "discount_type must be 'percent' or 'fixed'" },
      { status: 400 }
    );
  }
  if (typeof discount_value !== "number" || discount_value <= 0) {
    return NextResponse.json(
      { error: "discount_value must be a positive number" },
      { status: 400 }
    );
  }
  if (discount_type === "percent" && discount_value > 100) {
    return NextResponse.json(
      { error: "Percent discount cannot exceed 100" },
      { status: 400 }
    );
  }

  const { data, error } = await ctx.supabase
    .from("studio_discount_codes")
    .insert({
      studio_id: ctx.studioId,
      code: (code as string).trim().toUpperCase(),
      description: (description as string | undefined)?.trim() || null,
      discount_type,
      discount_value,
      scope:
        typeof scope === "string" &&
        ["all", "class", "event", "membership", "contract"].includes(scope)
          ? scope
          : "all",
      member_tag:
        typeof member_tag === "string" && member_tag.trim()
          ? member_tag.trim().toLowerCase()
          : null,
      expires_at: (expires_at as string) || null,
      usage_limit:
        typeof usage_limit === "number" && usage_limit > 0 ? usage_limit : null,
      one_time_per_member: one_time_per_member === true,
      is_active: is_active !== false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
