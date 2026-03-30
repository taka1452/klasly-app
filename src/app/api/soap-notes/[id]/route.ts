import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

async function getInstructorContext() {
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

  if (!profile?.studio_id || profile.role !== "instructor") return null;

  const { data: instructor } = await supabase
    .from("instructors")
    .select("id")
    .eq("profile_id", user.id)
    .eq("studio_id", profile.studio_id)
    .single();

  if (!instructor) return null;

  // Feature flag check
  const enabled = await isFeatureEnabled(profile.studio_id, FEATURE_KEYS.SOAP_NOTES);
  if (!enabled) return null;

  return { supabase, instructorId: instructor.id };
}

// PUT: 更新
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getInstructorContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.subjective !== undefined) updateData.subjective = body.subjective || null;
    if (body.objective !== undefined) updateData.objective = body.objective || null;
    if (body.assessment !== undefined) updateData.assessment = body.assessment || null;
    if (body.plan !== undefined) updateData.plan = body.plan || null;
    if (body.session_date !== undefined) updateData.session_date = body.session_date;
    if (body.session_id !== undefined) updateData.session_id = body.session_id || null;
    if (body.is_confidential !== undefined) updateData.is_confidential = body.is_confidential;

    const { data, error } = await ctx.supabase
      .from("soap_notes")
      .update(updateData)
      .eq("id", id)
      .eq("instructor_id", ctx.instructorId) // 自分のノートのみ
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE: 削除
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getInstructorContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error } = await ctx.supabase
      .from("soap_notes")
      .delete()
      .eq("id", id)
      .eq("instructor_id", ctx.instructorId); // 自分のノートのみ

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
