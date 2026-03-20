import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
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
      .select("studio_id, role, email")
      .eq("id", user.id)
      .single();

    const allowedRoles = ["instructor", "owner", "manager"];
    if (!profile?.studio_id || !allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: instructor } = await adminSupabase
      .from("instructors")
      .select("id, stripe_account_id")
      .eq("profile_id", user.id)
      .single();

    if (!instructor) {
      return NextResponse.json(
        { error: "Instructor record not found" },
        { status: 404 }
      );
    }

    const instructorEmail = profile.email ?? user.email ?? undefined;
    let connectAccountId = instructor.stripe_account_id;

    if (!connectAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: instructorEmail,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          studio_id: profile.studio_id,
          instructor_id: instructor.id,
        },
      });
      connectAccountId = account.id;

      await adminSupabase
        .from("instructors")
        .update({ stripe_account_id: connectAccountId })
        .eq("id", instructor.id);
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      "http://localhost:3000";

    const earningsPath = profile.role === "instructor"
      ? "/instructor/earnings"
      : "/my-earnings";

    const accountLink = await stripe.accountLinks.create({
      account: connectAccountId,
      refresh_url: `${baseUrl}${earningsPath}?refresh=true`,
      return_url: `${baseUrl}${earningsPath}?return=true`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
