import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, ctxReq: Ctx) {
  const { id } = await ctxReq.params;
  const ctx = await getDashboardContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role === "manager" && !ctx.permissions?.can_manage_settings) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  if (typeof body.code === "string") updates.code = body.code.trim().toUpperCase();
  if (body.description !== undefined) {
    updates.description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;
  }
  if (body.discount_type === "percent" || body.discount_type === "fixed") {
    updates.discount_type = body.discount_type;
  }
  if (typeof body.discount_value === "number" && body.discount_value > 0) {
    updates.discount_value = body.discount_value;
  }
  if (
    typeof body.scope === "string" &&
    ["all", "class", "event", "membership", "contract"].includes(body.scope)
  ) {
    updates.scope = body.scope;
  }
  if (body.member_tag !== undefined) {
    updates.member_tag =
      typeof body.member_tag === "string" && body.member_tag.trim()
        ? body.member_tag.trim().toLowerCase()
        : null;
  }
  if (body.expires_at !== undefined) {
    updates.expires_at = body.expires_at || null;
  }
  if (body.usage_limit !== undefined) {
    updates.usage_limit =
      typeof body.usage_limit === "number" && body.usage_limit > 0
        ? body.usage_limit
        : null;
  }
  if (typeof body.one_time_per_member === "boolean") {
    updates.one_time_per_member = body.one_time_per_member;
  }
  if (typeof body.is_active === "boolean") {
    updates.is_active = body.is_active;
  }

  const { data, error } = await ctx.supabase
    .from("studio_discount_codes")
    .update(updates)
    .eq("id", id)
    .eq("studio_id", ctx.studioId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(_: Request, ctxReq: Ctx) {
  const { id } = await ctxReq.params;
  const ctx = await getDashboardContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role === "manager" && !ctx.permissions?.can_manage_settings) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await ctx.supabase
    .from("studio_discount_codes")
    .delete()
    .eq("id", id)
    .eq("studio_id", ctx.studioId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
