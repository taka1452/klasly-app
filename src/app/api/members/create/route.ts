import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { checkPlanLimit } from "@/lib/plan-limits";
import { sendEmail } from "@/lib/email/send";
import { welcomeMember, waiverInvite } from "@/lib/email/templates";
import { WAIVER_FROM_EMAIL } from "@/lib/email/client";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  try {
    // 認証確認
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

    // service_role で profiles を取得（RLS をバイパスして 500 を回避）
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    const { data: ownerProfile } = await adminSupabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    if (ownerProfile?.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { fullName, email, phone, planType, credits, studioId } = body;

    if (!fullName || !email) {
      return NextResponse.json(
        { error: "Missing required fields: fullName, email" },
        { status: 400 }
      );
    }

    const targetStudioId = studioId ?? ownerProfile.studio_id;
    if (!targetStudioId) {
      return NextResponse.json(
        { error: "Studio not found. Please complete onboarding first." },
        { status: 400 }
      );
    }

    const limitCheck = await checkPlanLimit(adminSupabase, targetStudioId);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: `Member limit reached. Your ${limitCheck.plan} plan allows ${limitCheck.limit} members. Current: ${limitCheck.currentCount}.`,
        },
        { status: 403 }
      );
    }

    // 1. Auth ユーザーを作成（ランダムパスワード＋招待メール）
    const tempPassword =
      Math.random().toString(36).slice(-12) +
      Math.random().toString(36).slice(-4).toUpperCase() +
      "!";

    const { data: authUser, error: authError } =
      await adminSupabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    // 2. profiles を更新（トリガーで作成済みなので update）
    await adminSupabase
      .from("profiles")
      .update({
        studio_id: targetStudioId,
        role: "member",
        full_name: fullName,
        email: email,
        phone: phone || null,
      })
      .eq("id", authUser.user.id);

    // 3. members テーブルに INSERT
    const { data: newMember, error: memberError } = await adminSupabase
      .from("members")
      .insert({
        studio_id: targetStudioId,
        profile_id: authUser.user.id,
        plan_type: planType || "drop_in",
        credits: credits ?? 0,
        status: "active",
      })
      .select("id")
      .single();

    if (memberError) {
      return NextResponse.json(
        { error: memberError.message },
        { status: 400 }
      );
    }

    // 3b. Waiver template が存在する場合は waver 招待メールを送信
    const { data: waiverTemplate } = await adminSupabase
      .from("waiver_templates")
      .select("id")
      .eq("studio_id", targetStudioId)
      .single();

    if (waiverTemplate && newMember?.id) {
      const token = randomUUID();
      await adminSupabase.from("waiver_signatures").insert({
        member_id: newMember.id,
        sign_token: token,
        signed_name: "",
        signed_at: null,
        token_used: false,
      });

      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const signUrl = `${baseUrl}/waiver/sign/${token}`;
      const { data: studioData } = await adminSupabase
        .from("studios")
        .select("name")
        .eq("id", targetStudioId)
        .single();
      const { subject, html } = waiverInvite({
        memberName: fullName,
        studioName: studioData?.name ?? "Studio",
        signUrl,
      });
      sendEmail({
        to: email,
        subject,
        html,
        from: WAIVER_FROM_EMAIL,
      });
    }

    // 4. パスワードリセットメールを送信（会員が自分でパスワードを設定できるように）
    await adminSupabase.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    // 5. ウェルカムメールを送信
    const { data: studioData } = await adminSupabase
      .from("studios")
      .select("name")
      .eq("id", targetStudioId)
      .single();
    const { subject, html } = welcomeMember({
      memberName: fullName,
      studioName: studioData?.name ?? "Studio",
    });
    sendEmail({ to: email, subject, html });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
