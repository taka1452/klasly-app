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

    // 3. リファーラルコードを自動生成
    try {
      let code = "";
      for (let attempt = 0; attempt < 5; attempt++) {
        code = Math.random().toString(36).substring(2, 10).toUpperCase();
        const { error: codeError } = await adminSupabase
          .from("referral_codes")
          .insert({ studio_id: studio.id, code });
        if (!codeError) break;
        if (attempt === 4) console.error("[create-studio] Failed to generate unique referral code");
      }
    } catch {
      // リファーラルコード生成失敗はスタジオ作成をブロックしない
      console.error("[create-studio] Referral code generation failed");
    }

    // 4. リファーラルコード経由のサインアップ処理
    const cookies = request.headers.get("cookie") ?? "";
    const referralMatch = cookies.match(/klasly_referral=([A-Z0-9]+)/);
    const referralCode = referralMatch?.[1] ?? null;

    if (referralCode) {
      try {
        // リファーラルコードの有効性を確認
        const { data: refCode } = await adminSupabase
          .from("referral_codes")
          .select("studio_id")
          .eq("code", referralCode)
          .single();

        if (refCode) {
          // 自分のコードで自分を紹介するのを防止
          const { data: referrerOwner } = await adminSupabase
            .from("profiles")
            .select("id")
            .eq("studio_id", refCode.studio_id)
            .eq("role", "owner")
            .single();

          if (referrerOwner?.id !== user.id) {
            // studios.referred_by_code に保存
            await adminSupabase
              .from("studios")
              .update({ referred_by_code: referralCode })
              .eq("id", studio.id);

            // referral_rewards にpendingレコード作成
            await adminSupabase.from("referral_rewards").insert({
              referrer_studio_id: refCode.studio_id,
              referred_studio_id: studio.id,
              status: "pending",
            });

            // 紹介者にメール通知
            const { data: referrerProfile } = await adminSupabase
              .from("profiles")
              .select("email")
              .eq("studio_id", refCode.studio_id)
              .eq("role", "owner")
              .single();
            const { data: referrerStudio } = await adminSupabase
              .from("studios")
              .select("name")
              .eq("id", refCode.studio_id)
              .single();

            if (referrerProfile?.email) {
              const { referralSignup } = await import("@/lib/email/templates");
              const { sendEmail } = await import("@/lib/email/send");
              const { subject, html } = referralSignup({
                referrerStudioName: referrerStudio?.name ?? "Studio",
                newStudioName: name,
              });
              await sendEmail({
                to: referrerProfile.email,
                subject,
                html,
                studioId: refCode.studio_id,
                templateName: "referral_signup",
              });
            }
          }
        }
      } catch {
        // リファーラル処理失敗はスタジオ作成をブロックしない
        console.error("[create-studio] Referral processing failed");
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
