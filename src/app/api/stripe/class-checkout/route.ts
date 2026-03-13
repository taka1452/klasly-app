import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

    const body = await request.json();
    const { sessionId, memberId } = body;

    if (!sessionId || !memberId) {
      return NextResponse.json(
        { error: "sessionId and memberId are required" },
        { status: 400 }
      );
    }

    // Verify member belongs to user
    const { data: member } = await adminSupabase
      .from("members")
      .select("id, studio_id, profile_id")
      .eq("id", memberId)
      .single();

    if (!member || member.profile_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Look up session → class → instructor
    const { data: session } = await adminSupabase
      .from("class_sessions")
      .select("id, class_id, studio_id, session_date, start_time")
      .eq("id", sessionId)
      .single();

    if (!session || session.studio_id !== member.studio_id) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const { data: classData } = await adminSupabase
      .from("classes")
      .select("id, name, instructor_id")
      .eq("id", session.class_id)
      .single();

    if (!classData) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    // Get studio settings
    const { data: studio } = await adminSupabase
      .from("studios")
      .select(
        "id, payout_model, studio_fee_percentage, stripe_connect_account_id, stripe_connect_onboarding_complete"
      )
      .eq("id", member.studio_id)
      .single();

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    // Get drop-in product price
    const { data: dropInProduct } = await adminSupabase
      .from("products")
      .select("id, name, price, currency, description")
      .eq("studio_id", studio.id)
      .eq("is_active", true)
      .eq("type", "one_time")
      .order("sort_order", { ascending: true })
      .limit(1)
      .single();

    if (!dropInProduct) {
      return NextResponse.json(
        { error: "No drop-in product configured for this studio" },
        { status: 400 }
      );
    }

    // Get platform fee
    const { data: feeRow } = await adminSupabase
      .from("platform_settings")
      .select("value")
      .eq("key", "platform_fee_percent")
      .single();
    const platformFeePercent = parseFloat(feeRow?.value ?? "0") / 100;

    const amount = dropInProduct.price;
    const currency = (dropInProduct.currency ?? "usd").toLowerCase();
    const platformFee =
      platformFeePercent > 0 ? Math.round(amount * platformFeePercent) : 0;

    const origin =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    // Determine payout destination
    let stripeAccountId: string | null = null;
    let applicationFee = platformFee;
    let instructorId: string | null = null;
    let payoutModel = "studio";

    if (
      studio.payout_model === "instructor_direct" &&
      classData.instructor_id
    ) {
      const { data: instructor } = await adminSupabase
        .from("instructors")
        .select("id, stripe_account_id, stripe_onboarding_complete")
        .eq("id", classData.instructor_id)
        .single();

      if (instructor?.stripe_account_id && instructor.stripe_onboarding_complete) {
        // Route to instructor
        stripeAccountId = instructor.stripe_account_id;
        instructorId = instructor.id;
        payoutModel = "instructor_direct";

        // Add studio fee to application_fee
        const studioFee = Math.round(
          amount * (Number(studio.studio_fee_percentage) / 100)
        );
        applicationFee = platformFee + studioFee;
      }
    }

    // Fallback to studio account
    if (!stripeAccountId) {
      if (
        !studio.stripe_connect_account_id ||
        !studio.stripe_connect_onboarding_complete
      ) {
        return NextResponse.json(
          {
            error:
              "This studio has not set up payments yet. Please contact the studio owner.",
          },
          { status: 400 }
        );
      }
      stripeAccountId = studio.stripe_connect_account_id;
    }

    const metadata: Record<string, string> = {
      studio_id: studio.id,
      member_id: memberId,
      session_id: sessionId,
      class_id: classData.id,
      payout_model: payoutModel,
      product_id: dropInProduct.id,
    };
    if (instructorId) {
      metadata.instructor_id = instructorId;
      metadata.studio_fee = String(applicationFee - platformFee);
      metadata.platform_fee = String(platformFee);
      metadata.studio_fee_percentage = String(studio.studio_fee_percentage);
    }

    // At this point stripeAccountId is guaranteed to be non-null
    // (either instructor account or studio fallback; otherwise we returned early)
    const destinationAccount = stripeAccountId as string;

    const checkoutSession = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency,
              product_data: {
                name: `${classData.name} — ${session.session_date}`,
                description: dropInProduct.description ?? undefined,
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        payment_intent_data:
          applicationFee > 0
            ? { application_fee_amount: applicationFee }
            : undefined,
        success_url: `${origin}/my-bookings?payment=success&session_id=${sessionId}`,
        cancel_url: `${origin}/schedule`,
        metadata,
      },
      { stripeAccount: destinationAccount }
    );

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
