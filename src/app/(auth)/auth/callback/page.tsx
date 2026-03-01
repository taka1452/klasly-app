import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";
import AuthCallbackClient from "./auth-callback-client";

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
  if (profile.role === "owner") return `${origin}/`;
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

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; type?: string; next?: string }>;
}) {
  const params = await searchParams;
  const code = params?.code;
  const origin = getAppUrl();

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const email = (user.email ?? "").trim().toLowerCase();
        const adminEmails = (process.env.ADMIN_EMAILS ?? "")
          .split(",")
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean);
        if (adminEmails.length > 0 && adminEmails.includes(email)) {
          redirect(`${origin}/admin`);
        }
        const url = await getRedirectUrl(user.id, params?.type ?? null, params?.next ?? null);
        // マジックリンク招待でパスワード未設定の場合は先に /set-password へ
        if (
          params?.type === "magiclink" &&
          (user.user_metadata as { invited_without_password?: boolean } | undefined)?.invited_without_password
        ) {
          let path = "/";
          try {
            path = new URL(url).pathname || "/";
          } catch {
            path = url.startsWith("/") ? url.split("?")[0] || "/" : "/";
          }
          redirect(`${origin}/set-password?next=${encodeURIComponent(path)}`);
        }
        redirect(url);
      }
      redirect(params?.next ? `${origin}${params.next}` : `${origin}/`);
    }
    redirect(`${origin}/login?error=auth_callback_failed`);
  }

  return <AuthCallbackClient />;
}
