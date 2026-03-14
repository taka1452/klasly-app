import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getAppUrl } from "@/lib/app-url";

async function getRedirectUrl(
  userId: string,
  type: string | null,
  next: string | null
): Promise<string> {
  const origin = getAppUrl();
  if (type === "recovery") return `${origin}/reset-password`;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminSupabase = serviceRoleKey
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
      )
    : null;
  if (!adminSupabase) return next ? `${origin}${next}` : `${origin}/`;

  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("role, studio_id")
    .eq("id", userId)
    .single();

  if (!profile?.studio_id) return `${origin}/onboarding`;
  if (profile.role === "owner" || profile.role === "manager") return `${origin}/`;
  if (profile.role === "instructor") return `${origin}/instructor`;
  if (profile.role === "member") {
    const { data: member } = await adminSupabase
      .from("members")
      .select("waiver_signed")
      .eq("profile_id", userId)
      .eq("studio_id", profile.studio_id)
      .maybeSingle();
    const { data: template } = await adminSupabase
      .from("waiver_templates")
      .select("id")
      .eq("studio_id", profile.studio_id)
      .maybeSingle();
    if (template && member && !member.waiver_signed) return `${origin}/waiver`;
    return `${origin}/schedule`;
  }
  return next ? `${origin}${next}` : `${origin}/`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const type = searchParams.get("type");
  const next = searchParams.get("next");
  const origin = getAppUrl();

  // OAuth プロバイダーがエラーを返した場合（ユーザーが拒否など）
  if (error) {
    const msg = errorDescription ?? error;
    const targetPage = type === "signup" ? "signup" : "login";
    return NextResponse.redirect(
      `${origin}/${targetPage}?error=auth_callback_failed&msg=${encodeURIComponent(msg)}`
    );
  }

  // PKCE コード交換（Route Handler なので cookies().set() が正常動作する）
  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const email = (user.email ?? "").trim().toLowerCase();
        const adminEmails = (process.env.ADMIN_EMAILS ?? "")
          .split(",")
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean);
        if (adminEmails.length > 0 && adminEmails.includes(email)) {
          return NextResponse.redirect(`${origin}/admin`);
        }

        const url = await getRedirectUrl(user.id, type, next);

        // マジックリンク招待でパスワード未設定の場合は /set-password へ
        if (
          type === "magiclink" &&
          (user.user_metadata as { invited_without_password?: boolean } | undefined)
            ?.invited_without_password
        ) {
          let path = "/";
          try {
            path = new URL(url).pathname || "/";
          } catch {
            path = url.startsWith("/") ? url.split("?")[0] || "/" : "/";
          }
          return NextResponse.redirect(
            `${origin}/set-password?next=${encodeURIComponent(path)}`
          );
        }

        return NextResponse.redirect(url);
      }

      return NextResponse.redirect(next ? `${origin}${next}` : `${origin}/`);
    }

    const errMsg =
      exchangeError?.message ?? "Failed to complete sign in. Please try again.";
    const targetPage = type === "signup" ? "signup" : "login";
    return NextResponse.redirect(
      `${origin}/${targetPage}?error=auth_callback_failed&msg=${encodeURIComponent(errMsg)}`
    );
  }

  // コードなし（hash ベースの旧 implicit flow 用）→ クライアントコンポーネントページへ
  const processingUrl = new URL(`${origin}/auth/processing`);
  if (next) processingUrl.searchParams.set("next", next);
  if (type) processingUrl.searchParams.set("type", type);
  return NextResponse.redirect(processingUrl.toString());
}
