import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = serviceRoleKey
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
      : serverSupabase;

    // Verify owner/manager
    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    if (!profile?.studio_id || !["owner", "manager"].includes(profile.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the overage charge
    const { data: charge } = await supabase
      .from("instructor_overage_charges")
      .select("*")
      .eq("id", id)
      .eq("studio_id", profile.studio_id)
      .single();

    if (!charge) {
      return NextResponse.json({ error: "Charge not found" }, { status: 404 });
    }

    const body = await request.json();
    const { reason } = body;

    // If already charged via Stripe, issue a refund first
    if (charge.status === "charged" && charge.stripe_payment_intent_id) {
      try {
        const { data: studio } = await supabase
          .from("studios")
          .select("stripe_connect_account_id")
          .eq("id", profile.studio_id)
          .single();

        if (studio?.stripe_connect_account_id) {
          await stripe.refunds.create(
            { payment_intent: charge.stripe_payment_intent_id },
            { stripeAccount: studio.stripe_connect_account_id }
          );
        }
      } catch (err) {
        console.error("[Waive] Refund failed:", err);
        return NextResponse.json(
          { error: "Failed to refund the charge. Please refund manually in Stripe." },
          { status: 500 }
        );
      }
    } else if (charge.status !== "pending" && charge.status !== "failed") {
      return NextResponse.json(
        { error: `Cannot waive a charge with status: ${charge.status}` },
        { status: 400 }
      );
    }

    // Update to waived
    const { error: updateErr } = await supabase
      .from("instructor_overage_charges")
      .update({
        status: "waived",
        waived_by: user.id,
        waived_reason: reason || null,
      })
      .eq("id", id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
