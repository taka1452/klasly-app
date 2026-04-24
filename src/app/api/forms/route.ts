import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { DEFAULT_FIELDS_BY_TYPE } from "@/lib/forms/types";
import type { FormField, FormType } from "@/lib/forms/types";

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
  if (profile.role === "owner") {
    return { supabase, studioId: profile.studio_id, userId: user.id };
  }
  if (profile.role === "manager") {
    const { data: manager } = await supabase
      .from("managers")
      .select("can_manage_settings")
      .eq("profile_id", user.id)
      .eq("studio_id", profile.studio_id)
      .single();
    if (!manager?.can_manage_settings) return null;
    return { supabase, studioId: profile.studio_id, userId: user.id };
  }
  return null;
}

export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await ctx.supabase
    .from("custom_forms")
    .select("*")
    .eq("studio_id", ctx.studioId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach submission counts in a single pass.
  const formIds = (data || []).map((f) => f.id as string);
  let submissionCountByForm = new Map<string, number>();
  if (formIds.length > 0) {
    const { data: counts } = await ctx.supabase
      .from("custom_form_submissions")
      .select("form_id")
      .in("form_id", formIds);
    submissionCountByForm = (counts || []).reduce((m, r) => {
      const k = r.form_id as string;
      m.set(k, (m.get(k) || 0) + 1);
      return m;
    }, new Map<string, number>());
  }

  return NextResponse.json(
    (data || []).map((f) => ({
      ...f,
      submission_count: submissionCountByForm.get(f.id as string) || 0,
    }))
  );
}

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const formType = (body.form_type as FormType) || "custom";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const fields: FormField[] = Array.isArray(body.fields) && body.fields.length > 0
    ? body.fields
    : DEFAULT_FIELDS_BY_TYPE[formType];

  const { data, error } = await ctx.supabase
    .from("custom_forms")
    .insert({
      studio_id: ctx.studioId,
      form_type: formType,
      name,
      description: body.description?.trim() || null,
      intro_text: body.intro_text?.trim() || null,
      success_message: body.success_message?.trim() || null,
      fields,
      requires_signature: !!body.requires_signature,
      is_active: body.is_active ?? true,
      is_public: body.is_public ?? true,
      created_by: ctx.userId,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
