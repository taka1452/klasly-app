import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { WAIVER_PRESETS } from "@/lib/waiver-presets";

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
        { error: "Server configuration error: SUPABASE_SERVICE_ROLE_KEY is not set." },
        { status: 500 }
      );
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    let body: { name?: string; email?: string; phone?: string; waiverPresetId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json(
        { error: "Studio name is required." },
        { status: 400 }
      );
    }

    // 既にスタジオを持っているか確認
    const { data: existingProfile } = await adminSupabase
      .from("profiles")
      .select("studio_id")
      .eq("id", user.id)
      .maybeSingle();

    if (existingProfile?.studio_id) {
      return NextResponse.json(
        { error: "You already have a studio. Redirecting..." },
        { status: 400 }
      );
    }

    // 1. スタジオを作成
    const { data: studio, error: studioError } = await adminSupabase
      .from("studios")
      .insert({
        name,
        email: body.email || null,
        phone: body.phone || null,
      })
      .select("id")
      .single();

    if (studioError) {
      return NextResponse.json(
        { error: `Studio: ${studioError.message}` },
        { status: 400 }
      );
    }

    if (!studio?.id) {
      return NextResponse.json(
        { error: "Failed to create studio." },
        { status: 500 }
      );
    }

    // 2. プロフィールを更新（studio_id と role = owner）
    const { error: profileError } = await adminSupabase
      .from("profiles")
      .update({
        studio_id: studio.id,
        role: "owner",
      })
      .eq("id", user.id);

    if (profileError) {
      return NextResponse.json(
        { error: `Profile: ${profileError.message}` },
        { status: 400 }
      );
    }

    const waiverPresetId = body.waiverPresetId?.trim();
    if (waiverPresetId) {
      const preset = WAIVER_PRESETS.find((p) => p.id === waiverPresetId);
      if (preset) {
        const waiverContent = preset.content.replaceAll("{{STUDIO_NAME}}", name);
        await adminSupabase.from("waiver_templates").insert({
          studio_id: studio.id,
          title: "Liability Waiver",
          content: waiverContent,
        });
      }
    }

    return NextResponse.json({ success: true, studioId: studio.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
