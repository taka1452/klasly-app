import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Test account switcher.
 *
 * Used by the studio owner (or a manager with can_manage_settings) to log
 * into one of the studio's *test accounts* in order to experience the
 * instructor / member side of the app from inside their real studio.
 *
 * Safety model:
 *   - Only owners and managers with can_manage_settings may call this API.
 *   - You can ONLY switch to accounts in your own studio that are flagged
 *     is_test_account=true on their auth.users row (either created by
 *     onboarding or by the yogayoga seed script). Real users cannot be
 *     impersonated.
 *   - The magic link returned returns the browser as that test account.
 *     Hitting /switch-back restores the original session.
 */

const SHOULD_USE_ADMIN = () => !!process.env.SUPABASE_SERVICE_ROLE_KEY;

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * True if the caller is allowed to use the test account switcher.
 * Studio owner or a manager with can_manage_settings.
 */
async function isAuthorized(
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  studioId: string,
  role: string | null
): Promise<boolean> {
  if (role === "owner") return true;
  if (role === "manager") {
    const { data: mgr } = await supabase
      .from("managers")
      .select("can_manage_settings")
      .eq("profile_id", userId)
      .eq("studio_id", studioId)
      .maybeSingle();
    return mgr?.can_manage_settings === true;
  }
  return false;
}

/**
 * GET /api/dev/switch-role
 * Returns the list of switchable accounts (is_test_account=true) in the
 * caller's studio.
 */
export async function GET() {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!SHOULD_USE_ADMIN()) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }
    const supabase = adminClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();
    if (!profile?.studio_id) {
      return NextResponse.json({ error: "No studio" }, { status: 400 });
    }

    const authorized = await isAuthorized(
      supabase,
      user.id,
      profile.studio_id,
      profile.role
    );
    if (!authorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: studio } = await supabase
      .from("studios")
      .select("name")
      .eq("id", profile.studio_id)
      .single();

    // All profiles in this studio
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("studio_id", profile.studio_id);

    const accounts: Array<{
      id: string;
      name: string;
      email: string;
      role: string;
      isCurrent: boolean;
      isTest: boolean;
    }> = [];

    // Check is_test_account via auth user metadata. Batch-fetch list.
    for (const p of profiles ?? []) {
      let isTest = false;
      try {
        const { data } = await supabase.auth.admin.getUserById(p.id);
        isTest = data?.user?.user_metadata?.is_test_account === true;
      } catch {
        // ignore, default to false
      }
      // Always include the current user so they can see themselves pinned at
      // the top even if they are not a test account.
      const isCurrent = p.id === user.id;
      if (!isTest && !isCurrent) continue;
      accounts.push({
        id: p.id,
        name: p.full_name ?? p.email ?? "Unknown",
        email: p.email ?? "",
        role: p.role,
        isCurrent,
        isTest,
      });
    }

    // Current user on top, then instructors, members, managers
    const roleOrder: Record<string, number> = {
      owner: 0,
      manager: 1,
      instructor: 2,
      member: 3,
    };
    accounts.sort((a, b) => {
      if (a.isCurrent) return -1;
      if (b.isCurrent) return 1;
      const ra = roleOrder[a.role] ?? 9;
      const rb = roleOrder[b.role] ?? 9;
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      studioName: studio?.name ?? "",
      currentUserId: user.id,
      currentRole: profile.role,
      accounts,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/dev/switch-role
 * Generate a one-use magic link that logs the browser into the target
 * test account. Only is_test_account=true users in the caller's studio
 * are eligible.
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
    if (!SHOULD_USE_ADMIN()) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }
    const supabase = adminClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();
    if (!profile?.studio_id) {
      return NextResponse.json({ error: "No studio" }, { status: 400 });
    }

    const authorized = await isAuthorized(
      supabase,
      user.id,
      profile.studio_id,
      profile.role
    );
    if (!authorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { targetProfileId } = body;
    if (!targetProfileId) {
      return NextResponse.json(
        { error: "targetProfileId is required" },
        { status: 400 }
      );
    }

    // Target must be in the same studio.
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("id, email, studio_id")
      .eq("id", targetProfileId)
      .single();
    if (!targetProfile || targetProfile.studio_id !== profile.studio_id) {
      return NextResponse.json(
        { error: "Target user not found in this studio" },
        { status: 404 }
      );
    }

    // Target must be flagged as a test account. This is the critical gate
    // that prevents impersonating real members or instructors.
    const { data: targetAuth } = await supabase.auth.admin.getUserById(
      targetProfileId
    );
    const isTest =
      targetAuth?.user?.user_metadata?.is_test_account === true;
    if (!isTest) {
      return NextResponse.json(
        {
          error:
            "This account is not a test account. You can only switch to accounts flagged as test accounts.",
        },
        { status: 403 }
      );
    }
    if (!targetProfile.email) {
      return NextResponse.json(
        { error: "Target user has no email" },
        { status: 400 }
      );
    }

    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: targetProfile.email,
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

    return NextResponse.json({
      url: verifyUrl,
      originalProfileId: user.id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
