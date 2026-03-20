import { checkPlanLimit } from "@/lib/plan-limits";
import { sendEmail } from "@/lib/email/send";
import { welcomeMember } from "@/lib/email/templates";
import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app-url";
import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { ratelimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown";
    const { success } = await ratelimit.limit(ip);
    if (!success) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }
    // 認証確認（Owner または can_manage_members 権限を持つ Manager）
    const ctx = await getDashboardContext();
    if (!ctx) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (ctx.role === "manager" && !ctx.permissions?.can_manage_members) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminSupabase = ctx.supabase;

    const body = await request.json();
    const { fullName, email, phone, planType, credits, dateOfBirth, isMinor, guardianEmail } = body;

    if (!fullName || !email) {
      return NextResponse.json(
        { error: "Missing required fields: fullName, email" },
        { status: 400 }
      );
    }

    // Always use the authenticated user's studio (prevent cross-studio creation)
    const targetStudioId = ctx.studioId;
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

    // 1. Auth ユーザーを作成（パスワードなし・マジックリンクで初回ログイン）
    const { data: authUser, error: authError } =
      await adminSupabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: fullName, invited_without_password: true },
      });

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    const appUrl = getAppUrl();
    const { data: linkData, error: linkError } =
      await adminSupabase.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: {
          redirectTo: `${appUrl}/auth/callback`,
        },
      });

    if (linkError) {
      console.error("Failed to generate magic link for member:", linkError.message);
    }

    const magicLinkUrl =
      (linkData as { properties?: { action_link?: string } })?.properties
        ?.action_link ?? (linkData as { action_link?: string })?.action_link ?? null;

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
        is_minor: isMinor || false,
        date_of_birth: dateOfBirth || null,
        guardian_email: isMinor ? (guardianEmail || null) : null,
      })
      .select("id")
      .single();

    if (memberError) {
      return NextResponse.json(
        { error: memberError.message },
        { status: 400 }
      );
    }

    // 4. ウェルカムメールを送信（マジックリンク付き）。ウェイバーは初回ログイン時に /waiver で署名
    const { data: studioData } = await adminSupabase
      .from("studios")
      .select("name")
      .eq("id", targetStudioId)
      .single();
    const { subject, html } = welcomeMember({
      memberName: fullName,
      studioName: studioData?.name ?? "Studio",
      magicLinkUrl,
    });
    await sendEmail({ to: email, subject, html });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
