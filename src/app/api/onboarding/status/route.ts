import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ hasStudio: false, redirectToLogin: true }, { status: 200 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ hasStudio: false }, { status: 200 });
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("studio_id")
      .eq("id", user.id)
      .single();

    if (!profile?.studio_id) {
      return NextResponse.json({
        hasStudio: false,
        needsPlan: false,
        redirectToLogin: false,
      });
    }

    const { data: studio } = await adminSupabase
      .from("studios")
      .select("stripe_subscription_id")
      .eq("id", profile.studio_id)
      .single();

    const needsPlan = !studio?.stripe_subscription_id;

    return NextResponse.json({
      hasStudio: true,
      needsPlan,
      redirectToLogin: false,
    });
  } catch {
    return NextResponse.json({ hasStudio: false }, { status: 200 });
  }
}
