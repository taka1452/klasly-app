import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

/** Owner only. Replay: set onboarding_step = 0, do NOT touch onboarding_completed */
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
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "owner" || !profile?.studio_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const action = body?.action;

    if (action === "replay") {
      const { error } = await adminSupabase
        .from("profiles")
        .update({ onboarding_step: 0 })
        .eq("id", user.id);

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true });
    }

    if (action === "mark_complete") {
      const { error } = await adminSupabase
        .from("profiles")
        .update({
          onboarding_completed: true,
          onboarding_step: 0,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
