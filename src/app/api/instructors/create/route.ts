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

    // 1. パスワードなしでユーザーを作成（メール確認済みとしてマーク）
    const { data: authUser, error: authError } =
      await adminSupabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    // 2. マジックリンクを生成（本番では getAppUrl が NEXT_PUBLIC_APP_URL または VERCEL_URL を返す）
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
      console.error("Failed to generate magic link:", linkError.message);
    }

    // 3. マジックリンクURLを組み立て（generateLink が返す action_link を使用）
    const magicLinkUrl =
      (linkData as { properties?: { action_link?: string } })?.properties
        ?.action_link ?? (linkData as { action_link?: string })?.action_link ?? null;

    await adminSupabase.from("profiles").update({
      studio_id: targetStudioId,
      role: "instructor",
      full_name: fullName,
      phone: phone || null,
    }).eq("id", authUser.user.id);

    const { error: instructorError } = await adminSupabase
      .from("instructors")
      .insert({
        studio_id: targetStudioId,
        profile_id: authUser.user.id,
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
