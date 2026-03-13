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

    const { data: studio } = await adminSupabase
      .from("studios")
      .select("payout_model, studio_fee_percentage")
      .eq("id", profile.studio_id)
      .single();

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    // Get instructor Stripe connection statuses
    const { data: instructors } = await adminSupabase
      .from("instructors")
      .select("id, profile_id, stripe_account_id, stripe_onboarding_complete, profiles(full_name, email)")
      .eq("studio_id", profile.studio_id);

    const instructorStatuses = (instructors ?? []).map((inst) => {
      const prof = Array.isArray(inst.profiles)
        ? inst.profiles[0]
        : inst.profiles;
      return {
        id: inst.id,
        name: (prof as { full_name?: string })?.full_name ?? "Unknown",
        email: (prof as { email?: string })?.email ?? "",
        stripeConnected: !!inst.stripe_account_id,
        onboardingComplete: inst.stripe_onboarding_complete ?? false,
      };
    });

    return NextResponse.json({
      payout_model: studio.payout_model,
      studio_fee_percentage: Number(studio.studio_fee_percentage),
      instructors: instructorStatuses,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
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

    const body = await request.json();
    const { payout_model, studio_fee_percentage } = body;

    if (
      payout_model &&
      payout_model !== "studio" &&
      payout_model !== "instructor_direct"
    ) {
      return NextResponse.json(
        { error: "Invalid payout_model" },
        { status: 400 }
      );
    }

    if (
      studio_fee_percentage !== undefined &&
      (studio_fee_percentage < 0 || studio_fee_percentage > 100)
    ) {
      return NextResponse.json(
        { error: "studio_fee_percentage must be between 0 and 100" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (payout_model !== undefined) updates.payout_model = payout_model;
    if (studio_fee_percentage !== undefined)
      updates.studio_fee_percentage = studio_fee_percentage;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    await adminSupabase
      .from("studios")
      .update(updates)
      .eq("id", profile.studio_id);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
