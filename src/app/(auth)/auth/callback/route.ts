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

        if (profile?.role === "owner") {
          return NextResponse.redirect(`${origin}/`);
        }
        if (profile?.role === "instructor") {
          return NextResponse.redirect(`${origin}/instructor`);
        }
        if (profile?.role === "member") {
          return NextResponse.redirect(`${origin}/schedule`);
        }
        if (!profile?.studio_id) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }
      const next = searchParams.get("next") ?? "/";
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
