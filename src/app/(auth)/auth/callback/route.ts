import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getAppUrl, sanitizeRedirectPath } from "@/lib/app-url";

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
  if (!adminSupabase) return `${origin}${sanitizeRedirectPath(next)}`;

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
  return `${origin}${sanitizeRedirectPath(next)}`;
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

        // Public studio self-signup: a `pending_studio_id` was stashed in
        // user_metadata at signup time. Hook the user up to that studio
        // exactly once, then clear the metadata so we don't re-run.
        const meta = (user.user_metadata ?? {}) as {
          pending_studio_id?: string;
          full_name?: string;
        };
        if (meta.pending_studio_id) {
          const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          const adminSupabase = serviceRoleKey
            ? createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                serviceRoleKey
              )
            : null;
          if (adminSupabase) {
            const studioId = meta.pending_studio_id;
            const { data: studio } = await adminSupabase
              .from("studios")
              .select("id, is_demo, plan_status")
              .eq("id", studioId)
              .maybeSingle();
            const acceptedStatuses = new Set([
              "active",
              "trial",
              "trialing",
              null,
            ]);
            if (
              studio &&
              !studio.is_demo &&
              acceptedStatuses.has(studio.plan_status as string | null)
            ) {
              await adminSupabase
                .from("profiles")
                .update({
                  studio_id: studioId,
                  full_name: meta.full_name ?? null,
                  role: "member",
                })
                .eq("id", user.id);

              const { data: existingMember } = await adminSupabase
                .from("members")
                .select("id")
                .eq("studio_id", studioId)
                .eq("profile_id", user.id)
                .maybeSingle();
              if (!existingMember) {
                await adminSupabase.from("members").insert({
                  studio_id: studioId,
                  profile_id: user.id,
                  plan_type: "drop_in",
                  credits: 0,
                  status: "active",
                  joined_at: new Date().toISOString(),
                  waiver_signed: false,
                });
              }
            }
            // Clear the marker so this only runs once.
            await adminSupabase.auth.admin.updateUserById(user.id, {
              user_metadata: { ...meta, pending_studio_id: null },
            });
          }
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

      return NextResponse.redirect(`${origin}${sanitizeRedirectPath(next)}`);
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
  if (next) processingUrl.searchParams.set("next", sanitizeRedirectPath(next));
  if (type) processingUrl.searchParams.set("type", type);
  return NextResponse.redirect(processingUrl.toString());
}
