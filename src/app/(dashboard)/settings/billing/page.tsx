import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { stripe } from "@/lib/stripe/server";
import BillingActions from "@/components/settings/billing-actions";

/*
 * Stripe Dashboard: Create Product "Klasly Pro" with:
 * - Price 1: $19/month (recurring monthly)
 * - Price 2: $190/year (recurring yearly)
 * Env: STRIPE_PRO_MONTHLY_PRICE_ID, STRIPE_PRO_YEARLY_PRICE_ID
 */

export default async function BillingPage() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) redirect("/login");

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
      )
    : serverSupabase;

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id || profile.role !== "owner") redirect("/");

  const { data: studio } = await supabase
    .from("studios")
    .select(
      "id, plan, plan_status, stripe_customer_id, stripe_subscription_id, trial_ends_at, subscription_period, current_period_end, cancel_at_period_end, grace_period_ends_at"
    )
    .eq("id", profile.studio_id)
    .single();

  if (!studio) redirect("/");

  let nextBillingDate: string | null = null;
  let cardLast4: string | null = null;
  let subscriptionStart: number | null = null;
  let appliedCouponCode: string | null = null;

  if (studio.stripe_subscription_id) {
    try {
      const sub = await stripe.subscriptions.retrieve(
        studio.stripe_subscription_id,
        { expand: ["default_payment_method", "discounts.promotion_code"] }
      );
      const periodEnd = sub.items?.data?.[0]?.current_period_end;
      if (periodEnd) {
        nextBillingDate = new Date(periodEnd * 1000).toLocaleDateString(
          "en-US",
          { year: "numeric", month: "long", day: "numeric" }
        );
      }
      subscriptionStart = sub.created;
      const pm = sub.default_payment_method as {
        card?: { last4?: string };
      } | null;
      if (pm?.card?.last4) cardLast4 = pm.card.last4;
      const first = Array.isArray(sub.discounts) && sub.discounts.length > 0 ? sub.discounts[0] : null;
      const discount = first && typeof first === "object" ? first : null;
      const promo = discount && "promotion_code" in discount && discount.promotion_code
        ? (typeof discount.promotion_code === "object" ? (discount.promotion_code as { code?: string }).code ?? null : null)
        : null;
      if (promo) appliedCouponCode = promo;
    } catch {
      // ignore Stripe errors
    }
  }

  const trialEndsAtFormatted =
    studio.trial_ends_at != null
      ? new Date(studio.trial_ends_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

  const currentPeriodEndFormatted =
    studio.current_period_end != null
      ? new Date(studio.current_period_end).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : nextBillingDate;

  const gracePeriodEndsAtFormatted =
    studio.grace_period_ends_at != null
      ? new Date(studio.grace_period_ends_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

  const statusLabels: Record<string, string> = {
    trialing: "Trialing",
    active: "Active",
    past_due: "Past Due",
    grace: "Grace Period",
    canceled: "Canceled",
  };
  const statusLabel =
    statusLabels[studio.plan_status ?? ""] ?? studio.plan_status ?? "Unknown";

  const periodLabel =
    studio.subscription_period === "yearly"
      ? "Yearly ($190/year)"
      : "Monthly ($19/month)";

  const isYearlyWithinRefund =
    studio.subscription_period === "yearly" &&
    subscriptionStart != null &&
    Date.now() / 1000 - subscriptionStart < 14 * 24 * 60 * 60;

  return (
    <div>
      <Link
        href="/settings"
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        ← Back to Settings
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-gray-900">Billing</h1>
      <p className="mt-1 text-sm text-gray-500">
        Manage your subscription and payment methods
      </p>

      <div className="mt-8 card">
        <h2 className="text-lg font-semibold text-gray-900">Current Plan</h2>
        <dl className="mt-4 space-y-3">
          <div>
            <dt className="text-xs text-gray-400">Plan</dt>
            <dd className="text-sm font-medium text-gray-900">
              Pro ({periodLabel})
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Status</dt>
            <dd className="text-sm font-medium text-gray-900">{statusLabel}</dd>
          </div>
          {studio.plan_status === "trialing" && trialEndsAtFormatted && (
            <div>
              <dt className="text-xs text-gray-400">Trial ends on</dt>
              <dd className="text-sm font-medium text-gray-900">
                {trialEndsAtFormatted}
              </dd>
            </div>
          )}
          {(studio.plan_status === "active" ||
            studio.plan_status === "past_due" ||
            studio.plan_status === "grace") &&
            (currentPeriodEndFormatted || nextBillingDate) && (
              <div>
                <dt className="text-xs text-gray-400">
                  {studio.cancel_at_period_end
                    ? "Subscription ends on"
                    : "Next billing date"}
                </dt>
                <dd className="text-sm font-medium text-gray-900">
                  {currentPeriodEndFormatted || nextBillingDate}
                </dd>
              </div>
            )}
          {studio.cancel_at_period_end && (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-sm text-amber-800">
                Your subscription will end on{" "}
                {currentPeriodEndFormatted || "the period end"}.
              </p>
            </div>
          )}
          {studio.plan_status === "grace" && gracePeriodEndsAtFormatted && (
            <div>
              <dt className="text-xs text-gray-400">Access suspended on</dt>
              <dd className="text-sm font-medium text-gray-900">
                {gracePeriodEndsAtFormatted}
              </dd>
            </div>
          )}
          {cardLast4 && (
            <div>
              <dt className="text-xs text-gray-400">Card</dt>
              <dd className="text-sm font-medium text-gray-900">
                •••• {cardLast4}
              </dd>
            </div>
          )}
          {appliedCouponCode && (
            <div>
              <dt className="text-xs text-gray-400">Discount</dt>
              <dd className="text-sm font-medium text-green-600">
                {appliedCouponCode}
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-6">
          <BillingActions
            planStatus={studio.plan_status ?? "trialing"}
            subscriptionPeriod={studio.subscription_period ?? "monthly"}
            cancelAtPeriodEnd={!!studio.cancel_at_period_end}
            hasStripeSubscription={!!studio.stripe_subscription_id}
            isYearlyWithinRefundWindow={!!isYearlyWithinRefund}
            appliedCouponCode={appliedCouponCode}
          />
        </div>
      </div>
    </div>
  );
}
