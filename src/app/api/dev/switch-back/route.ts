import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Companion to /api/dev/switch-role. Returns the browser to the original
 * user account after a test-account impersonation session.
 *
 * The current session MUST be a test account (is_test_account=true) and the
 * target MUST be a real owner or manager (is_test_account=false, but
 * can_manage_settings gating could be added here if we ever let managers
 * start sessions — which we do).
 */
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

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    const { data: currentAuth } = await supabase.auth.admin.getUserById(
      user.id
    );
    const currentIsTest =
      currentAuth?.user?.user_metadata?.is_test_account === true;
    if (!currentIsTest) {
      return NextResponse.json(
        { error: "Only usable while signed in as a test account" },
        { status: 403 }
      );
    }

    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("studio_id")
      .eq("id", user.id)
      .single();
    if (!currentProfile?.studio_id) {
      return NextResponse.json({ error: "No studio" }, { status: 400 });
    }

    const { originalProfileId } = await request.json();
    if (!originalProfileId) {
      return NextResponse.json(
        { error: "originalProfileId is required" },
        { status: 400 }
      );
    }

    // Original must be a real owner/manager in the same studio.
    const { data: target } = await supabase
      .from("profiles")
      .select("id, email, role, studio_id")
      .eq("id", originalProfileId)
      .single();
    if (!target || target.studio_id !== currentProfile.studio_id) {
      return NextResponse.json(
        { error: "Original account not found in this studio" },
        { status: 404 }
      );
    }
    if (target.role !== "owner" && target.role !== "manager") {
      return NextResponse.json(
        { error: "Original account must be an owner or manager" },
        { status: 403 }
      );
    }
    if (!target.email) {
      return NextResponse.json(
        { error: "Original account has no email" },
        { status: 400 }
      );
    }

    // For safety: ensure target is NOT a test account (i.e. a real staff
    // user). Otherwise someone could chain switch-back to escape the
    // impersonation gate.
    const { data: targetAuth } = await supabase.auth.admin.getUserById(
      originalProfileId
    );
    if (targetAuth?.user?.user_metadata?.is_test_account === true) {
      return NextResponse.json(
        { error: "Original account cannot be a test account" },
        { status: 403 }
      );
    }

    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: target.email,
      });
    if (linkError || !linkData) {
      return NextResponse.json(
        { error: linkError?.message ?? "Failed to generate link" },
        { status: 500 }
      );
    }

    const origin =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://app.klasly.app";
    const tokenHash = linkData.properties?.hashed_token;
    if (!tokenHash) {
      return NextResponse.json(
        { error: "Failed to generate token" },
        { status: 500 }
      );
    }

    const verifyUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify?token=${tokenHash}&type=magiclink&redirect_to=${encodeURIComponent(
      origin + "/auth/callback"
    )}`;

    // Audit log — best-effort.
    try {
      await supabase.from("test_account_impersonation_logs").insert({
        studio_id: currentProfile.studio_id,
        actor_profile_id: user.id,
        target_profile_id: originalProfileId,
        action: "switch_back",
        actor_role: "test_account",
        target_role: target.role ?? null,
        user_agent: request.headers.get("user-agent") ?? null,
        ip_address:
          request.headers.get("x-forwarded-for") ??
          request.headers.get("x-real-ip") ??
          null,
      });
    } catch (err) {
      console.warn("[switch-back] audit log failed:", err);
    }

    return NextResponse.json({ url: verifyUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
