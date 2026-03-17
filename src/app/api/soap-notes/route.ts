import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

async function getContext() {
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

  if (!profile?.studio_id) return null;

  // Feature flag check
  const enabled = await isFeatureEnabled(profile.studio_id, FEATURE_KEYS.SOAP_NOTES);
  if (!enabled) return null;

  return { supabase, profile, userId: user.id };
}

// GET: SOAP Notes一覧
export async function GET(request: Request) {
  try {
    const ctx = await getContext();
    if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("member_id");

    if (!memberId) {
      return NextResponse.json({ error: "member_id is required" }, { status: 400 });
    }

    const { supabase, profile, userId } = ctx;

    if (profile.role === "instructor") {
      // インストラクターは自分のノートのみ
      const { data: instructor } = await supabase
        .from("instructors")
        .select("id")
        .eq("profile_id", userId)
        .eq("studio_id", profile.studio_id)
        .single();

      if (!instructor) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { data: notes } = await supabase
        .from("soap_notes")
        .select("*")
        .eq("instructor_id", instructor.id)
        .eq("member_id", memberId)
        .order("session_date", { ascending: false });

      return NextResponse.json({ notes: notes || [], role: "instructor" });
    }

    if (["owner", "manager"].includes(profile.role)) {
      // オーナー/マネージャーは非機密のみ + 機密件数
      const { data: nonConfidential } = await supabase
        .from("soap_notes")
        .select("*, instructors(profiles(full_name))")
        .eq("member_id", memberId)
        .eq("studio_id", profile.studio_id)
        .eq("is_confidential", false)
        .order("session_date", { ascending: false });

      const { count: confidentialCount } = await supabase
        .from("soap_notes")
        .select("id", { count: "exact", head: true })
        .eq("member_id", memberId)
        .eq("studio_id", profile.studio_id)
        .eq("is_confidential", true);

      return NextResponse.json({
        notes: nonConfidential || [],
        confidentialCount: confidentialCount || 0,
        role: "owner",
      });
    }

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: 新規作成
export async function POST(request: Request) {
  try {
    const ctx = await getContext();
    if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { supabase, profile, userId } = ctx;

    if (profile.role !== "instructor") {
      return NextResponse.json({ error: "Only instructors can create SOAP notes" }, { status: 403 });
    }

    const { data: instructor } = await supabase
      .from("instructors")
      .select("id")
      .eq("profile_id", userId)
      .eq("studio_id", profile.studio_id)
      .single();

    if (!instructor) {
      return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
    }

    const body = await request.json();
    const { member_id, session_id, subjective, objective, assessment, plan, session_date, is_confidential } = body;

    if (!member_id || !session_date) {
      return NextResponse.json({ error: "member_id and session_date are required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("soap_notes")
      .insert({
        studio_id: profile.studio_id,
        instructor_id: instructor.id,
        member_id,
        session_id: session_id || null,
        subjective: subjective || null,
        objective: objective || null,
        assessment: assessment || null,
        plan: plan || null,
        session_date,
        is_confidential: is_confidential ?? true,
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
