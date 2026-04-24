import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

async function getAdminContext() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) return null;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
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
      .select("can_manage_settings")
      .eq("profile_id", user.id)
      .eq("studio_id", profile.studio_id)
      .single();
    if (!manager?.can_manage_settings) return null;
    return { supabase, studioId: profile.studio_id };
  }
  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { data, error } = await ctx.supabase
    .from("custom_forms")
    .select("*")
    .eq("id", id)
    .eq("studio_id", ctx.studioId)
    .single();
  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) {
    updates.name = typeof body.name === "string" ? body.name.trim() : null;
  }
  if (body.description !== undefined) {
    updates.description =
      typeof body.description === "string" && body.description.trim().length > 0
        ? body.description.trim()
        : null;
  }
  if (body.intro_text !== undefined) {
    updates.intro_text =
      typeof body.intro_text === "string" && body.intro_text.trim().length > 0
        ? body.intro_text.trim()
        : null;
  }
  if (body.success_message !== undefined) {
    updates.success_message =
      typeof body.success_message === "string" && body.success_message.trim().length > 0
        ? body.success_message.trim()
        : null;
  }
  if (body.form_type !== undefined) updates.form_type = body.form_type;
  if (body.fields !== undefined) updates.fields = body.fields;
  if (body.requires_signature !== undefined) updates.requires_signature = !!body.requires_signature;
  if (body.is_active !== undefined) updates.is_active = !!body.is_active;
  if (body.is_public !== undefined) updates.is_public = !!body.is_public;

  const { data, error } = await ctx.supabase
    .from("custom_forms")
    .update(updates)
    .eq("id", id)
    .eq("studio_id", ctx.studioId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { error } = await ctx.supabase
    .from("custom_forms")
    .delete()
    .eq("id", id)
    .eq("studio_id", ctx.studioId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
