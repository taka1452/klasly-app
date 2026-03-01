import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ url: "/login" });
    }

    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const email = (user.email ?? "").trim().toLowerCase();
    if (adminEmails.length > 0 && adminEmails.includes(email)) {
      return NextResponse.json({ url: "/admin" });
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

    if (!profile?.studio_id) {
      return NextResponse.json({ url: "/onboarding" });
    }
    if (profile.role === "owner") {
      return NextResponse.json({ url: "/" });
    }
    if (profile.role === "instructor") {
      return NextResponse.json({ url: "/instructor" });
    }
    if (profile.role === "member") {
      const { data: member } = await adminSupabase
        .from("members")
        .select("waiver_signed")
        .eq("profile_id", user.id)
        .eq("studio_id", profile.studio_id)
        .maybeSingle();
      const { data: template } = await adminSupabase
        .from("waiver_templates")
        .select("id")
        .eq("studio_id", profile.studio_id)
        .maybeSingle();
      if (template && member && !member.waiver_signed) {
        return NextResponse.json({ url: "/waiver" });
      }
      return NextResponse.json({ url: "/schedule" });
    }
    return NextResponse.json({ url: "/" });
  } catch (err) {
    console.error("[redirect-destination]", err);
    return NextResponse.json({ url: "/" }, { status: 200 });
  }
}
