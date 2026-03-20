import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";
import { NextResponse } from "next/server";
import { resolveStudioFee, calculateStudioFee } from "@/lib/fee/resolve-fee";
import { ratelimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown";
    const { success } = await ratelimit.limit(ip);
    if (!success) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }
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

    // Look up session with class_templates join
    const { data: session } = await adminSupabase
      .from("class_sessions")
      .select("id, template_id, studio_id, session_date, start_time, instructor_id, price_cents, title, class_templates(id, name, instructor_id, price_cents)")
      .eq("id", sessionId)
      .single();

    if (!session || session.studio_id !== member.studio_id) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Extract template data (may be null for room_only sessions)
    const rawTemplate = session.class_templates;
    const templateData = Array.isArray(rawTemplate) ? rawTemplate[0] : rawTemplate;

    // Resolve instructor_id: session-level > template-level
    const resolvedInstructorId = session.instructor_id ?? templateData?.instructor_id ?? null;

    // Get studio settings
    const { data: studio } = await adminSupabase
      .from("studios")
      .select(
        "id, payout_model, studio_fee_percentage, studio_fee_type, stripe_connect_account_id, stripe_connect_onboarding_complete"
      )
      .eq("id", member.studio_id)
      .single();

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    // Determine price: session.price_cents > template.price_cents > drop-in product
    let amount: number;
    let currency = "usd";
    let productId: string | null = null;
    let productDescription: string | null = null;

    if (
      session.price_cents !== null &&
      session.price_cents !== undefined
    ) {
      // Session-level price takes priority
      amount = session.price_cents;
    } else if (
      templateData?.price_cents !== null &&
      templateData?.price_cents !== undefined &&
      studio.payout_model === "instructor_direct"
    ) {
      // Template-level price (Collective Mode)
      amount = templateData.price_cents;
    } else {
      // Studio Mode: use drop-in product price
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

      amount = dropInProduct.price;
      currency = (dropInProduct.currency ?? "usd").toLowerCase();
      productId = dropInProduct.id;
      productDescription = dropInProduct.description ?? null;
    }

    // Get platform fee
    const { data: feeRow } = await adminSupabase
      .from("platform_settings")
      .select("value")
      .eq("key", "platform_fee_percent")
      .single();
    const platformFeePercent = parseFloat(feeRow?.value ?? "0") / 100;

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
    let resolvedFeeType = "percentage";
    let resolvedFeeSource = "studio_default";
    let resolvedFeeValue = Number(studio.studio_fee_percentage);

    if (
      studio.payout_model === "instructor_direct" &&
      resolvedInstructorId
    ) {
      const { data: instructor } = await adminSupabase
        .from("instructors")
        .select("id, stripe_account_id, stripe_onboarding_complete")
        .eq("id", resolvedInstructorId)
        .single();

      if (instructor?.stripe_account_id && instructor.stripe_onboarding_complete) {
        // Route to instructor
        stripeAccountId = instructor.stripe_account_id;
        instructorId = instructor.id;
        payoutModel = "instructor_direct";

        // Resolve fee using priority hierarchy (Phase 3a/3b support)
        const { data: feeOverride } = await adminSupabase
          .from("instructor_fee_overrides")
          .select("fee_type, fee_value")
          .eq("studio_id", studio.id)
          .eq("instructor_id", instructor.id)
          .maybeSingle();

        // Phase 3a: Class fee override — use template_id if available
        let classFeeOverride = null;
        if (templateData?.id) {
          const { data: cfo } = await adminSupabase
            .from("class_fee_overrides")
            .select("fee_type, fee_value")
            .eq("studio_id", studio.id)
            .eq("class_id", templateData.id)
            .maybeSingle();
          classFeeOverride = cfo;
        }

        // Phase 3b: Fee schedules
        const { data: feeSchedules } = await adminSupabase
          .from("fee_schedules")
          .select("fee_type, fee_value, day_of_week, start_time, end_time, priority, is_active")
          .eq("studio_id", studio.id)
          .eq("is_active", true);

        const resolved = resolveStudioFee(
          {
            studio_fee_type: studio.studio_fee_type ?? "percentage",
            studio_fee_percentage: Number(studio.studio_fee_percentage),
          },
          feeOverride ?? undefined,
          classFeeOverride ?? undefined,
          feeSchedules ?? undefined,
          session.start_time,
          new Date(session.session_date).getDay()
        );

        resolvedFeeType = resolved.feeType;
        resolvedFeeSource = resolved.feeSource;
        resolvedFeeValue = resolved.feeValue;

        // Calculate studio fee using resolved fee
        const studioFee = calculateStudioFee(amount, resolved);
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

    // Resolve display name: session title > template name > "Session"
    const displayName = session.title || templateData?.name || "Session";

    const metadata: Record<string, string> = {
      studio_id: studio.id,
      member_id: memberId,
      session_id: sessionId,
      payout_model: payoutModel,
    };
    if (session.template_id) {
      metadata.template_id = session.template_id;
    }
    if (productId) {
      metadata.product_id = productId;
    }
    if (instructorId) {
      metadata.instructor_id = instructorId;
      metadata.studio_fee = String(applicationFee - platformFee);
      metadata.platform_fee = String(platformFee);
      metadata.studio_fee_percentage = String(resolvedFeeValue);
      metadata.fee_type = resolvedFeeType;
      metadata.fee_source = resolvedFeeSource;
    }

    // At this point stripeAccountId is guaranteed to be non-null
    const destinationAccount = stripeAccountId as string;

    const checkoutSession = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency,
              product_data: {
                name: `${displayName} — ${session.session_date}`,
                description: productDescription ?? undefined,
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
