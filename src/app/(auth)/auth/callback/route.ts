import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

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
          return NextResponse.redirect(`${origin}/admin`);
        }

        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const adminSupabase = serviceRoleKey
          ? createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              serviceRoleKey
            )
          : supabase;
        const { data: profile } = await adminSupabase
          .from("profiles")
          .select("role, studio_id")
          .eq("id", user.id)
          .single();

        // 2. studio_id がない場合 → オンボーディングへ（role より先）
        if (!profile?.studio_id) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }

        // 3. Role 判定（studio_id がある場合のみ）
        if (profile?.role === "owner") {
          return NextResponse.redirect(`${origin}/`);
        }
        if (profile?.role === "instructor") {
          return NextResponse.redirect(`${origin}/instructor`);
        }
        if (profile?.role === "member") {
          return NextResponse.redirect(`${origin}/schedule`);
        }
      }
      const next = searchParams.get("next") ?? "/";
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
