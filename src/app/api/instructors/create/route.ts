import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/send";
import { instructorInvite } from "@/lib/email/templates";
import { getAppUrl } from "@/lib/app-url";

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
        {
          error:
            "Server configuration error: SUPABASE_SERVICE_ROLE_KEY is not set.",
        },
        { status: 500 }
      );
    }

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
    const { fullName, email, phone, bio, specialties, studioId } = body;

    if (!fullName || !email) {
      return NextResponse.json(
        { error: "Missing required fields: fullName, email" },
        { status: 400 }
      );
    }

    const targetStudioId = studioId ?? ownerProfile.studio_id;
    if (!targetStudioId) {
      return NextResponse.json(
        {
          error: "Studio not found. Please complete onboarding first.",
        },
        { status: 400 }
      );
    }

    const emailNorm = (email as string).trim().toLowerCase();
    let authUserId: string;

    // 1. Auth ユーザー作成（既存の場合は listUsers で検索して再利用 or 同一スタジオならエラー）
    const { data: authData, error: authError } =
      await adminSupabase.auth.admin.createUser({
        email: emailNorm,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

    if (authError) {
      const isAlreadyRegistered =
        /already registered|already exists|already been registered/i.test(
          authError.message
        );
      if (!isAlreadyRegistered) {
        return NextResponse.json(
          { error: authError.message },
          { status: 400 }
        );
      }

      // 既存ユーザーをメールで検索（listUsers はメール絞り込み非対応のため取得してからフィルタ）
      const { data: listData } = await adminSupabase.auth.admin.listUsers({
        page: 1,
        per_page: 1000,
      });
      const existingAuthUser = listData?.users?.find(
        (u) => (u.email ?? "").trim().toLowerCase() === emailNorm
      );
      if (!existingAuthUser) {
        return NextResponse.json(
          { error: authError.message },
          { status: 400 }
        );
      }

      const { data: existingProfile } = await adminSupabase
        .from("profiles")
        .select("studio_id, role")
        .eq("id", existingAuthUser.id)
        .single();

      // 同じスタジオに既にインストラクターとして登録済みか
      const { data: existingInstructor } = await adminSupabase
        .from("instructors")
        .select("id")
        .eq("profile_id", existingAuthUser.id)
        .eq("studio_id", targetStudioId)
        .maybeSingle();

      if (existingInstructor) {
        return NextResponse.json(
          {
            error: "This instructor is already registered in your studio.",
          },
          { status: 400 }
        );
      }

      // 別スタジオ or studio_id が NULL → 既存ユーザーを再利用
      authUserId = existingAuthUser.id;
      await adminSupabase.from("profiles").update({
        studio_id: targetStudioId,
        role: "instructor",
        full_name: fullName,
        phone: phone || null,
      }).eq("id", authUserId);
    } else {
      authUserId = authData!.user.id;
      await adminSupabase.from("profiles").update({
        studio_id: targetStudioId,
        role: "instructor",
        full_name: fullName,
        phone: phone || null,
      }).eq("id", authUserId);
    }

    // 2. マジックリンクを生成（本番では getAppUrl が NEXT_PUBLIC_APP_URL または VERCEL_URL を返す）
    const appUrl = getAppUrl();
    const { data: linkData, error: linkError } =
      await adminSupabase.auth.admin.generateLink({
        type: "magiclink",
        email: emailNorm,
        options: {
          redirectTo: `${appUrl}/auth/callback`,
        },
      });

    if (linkError) {
      console.error("Failed to generate magic link:", linkError.message);
    }

    const magicLinkUrl =
      (linkData as { properties?: { action_link?: string } })?.properties
        ?.action_link ?? (linkData as { action_link?: string })?.action_link ?? null;

    const { error: instructorError } = await adminSupabase
      .from("instructors")
      .insert({
        studio_id: targetStudioId,
        profile_id: authUserId,
        bio: bio || null,
        specialties: Array.isArray(specialties)
          ? specialties
          : specialties
            ? [specialties]
            : null,
      });

    if (instructorError) {
      return NextResponse.json(
        { error: instructorError.message },
        { status: 400 }
      );
    }

    const { data: studio } = await adminSupabase
      .from("studios")
      .select("name")
      .eq("id", targetStudioId)
      .single();

    const studioName = (studio as { name?: string })?.name ?? "Studio";
    const invite = instructorInvite({
      instructorName: fullName,
      studioName,
      email,
      magicLinkUrl,
    });
    await sendEmail({ to: email, subject: invite.subject, html: invite.html });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
