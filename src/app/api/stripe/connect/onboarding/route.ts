import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";
import { NextResponse } from "next/server";
import { isTestAccount, TEST_ACCOUNT_STRIPE_ERROR } from "@/lib/auth/test-account-guard";
import {
  defaultCountryFromTimezone,
  isSupportedConnectCountry,
} from "@/lib/stripe/connect-countries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (await isTestAccount(user.id)) {
      return NextResponse.json(
        { error: TEST_ACCOUNT_STRIPE_ERROR, code: "TEST_ACCOUNT_BLOCKED" },
        { status: 403 }
      );
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

    if (profile?.role !== "owner" || !profile?.studio_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const studioId = profile.studio_id;
    const ownerEmail = profile.email ?? user.email ?? undefined;

    const { data: studio } = await adminSupabase
      .from("studios")
      .select("stripe_connect_account_id, timezone")
      .eq("id", studioId)
      .single();

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    let connectAccountId = studio.stripe_connect_account_id;

    if (!connectAccountId) {
      // Country is required on Express account creation and cannot be changed
      // later. Accept an explicit override, falling back to a timezone guess.
      const body = await request.json().catch(() => ({}));
      const requestedCountry =
        typeof body?.country === "string" ? body.country.toUpperCase() : null;
      const country = isSupportedConnectCountry(requestedCountry)
        ? requestedCountry
        : defaultCountryFromTimezone(studio.timezone);

      const account = await stripe.accounts.create({
        type: "express",
        country,
        email: ownerEmail,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          studio_id: studioId,
        },
      });
      connectAccountId = account.id;

      await adminSupabase
        .from("studios")
        .update({ stripe_connect_account_id: connectAccountId })
        .eq("id", studioId);
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";

    const accountLink = await stripe.accountLinks.create({
      account: connectAccountId,
      refresh_url: `${baseUrl}/settings/connect?refresh=true`,
      return_url: `${baseUrl}/settings/connect?return=true`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
