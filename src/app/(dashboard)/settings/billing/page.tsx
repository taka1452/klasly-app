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
  let subscriptionStart: number | null = null;
  let appliedCouponCode: string | null = null;
  let stripeError: string | null = null;
  type PaymentMethodInfo = {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  } | null;
  let paymentMethod: PaymentMethodInfo = null;

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
        card?: { brand?: string; last4?: string; exp_month?: number; exp_year?: number };
      } | null;
      if (pm?.card?.last4) {
        paymentMethod = {
          brand: pm.card.brand ?? "Card",
          last4: pm.card.last4,
          exp_month: pm.card.exp_month ?? 0,
          exp_year: pm.card.exp_year ?? 0,
        };
      }
      const first = Array.isArray(sub.discounts) && sub.discounts.length > 0 ? sub.discounts[0] : null;
      const discount = first && typeof first === "object" ? first : null;
      const promo = discount && "promotion_code" in discount && discount.promotion_code
        ? (typeof discount.promotion_code === "object" ? (discount.promotion_code as { code?: string }).code ?? null : null)
        : null;
      if (promo) appliedCouponCode = promo;
    } catch (err) {
      // Capture Stripe errors for display
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("No such customer") || msg.includes("No such subscription")) {
        stripeError = "Your billing account could not be found in Stripe. This may happen if Stripe test data was reset. Please contact support to re-link your account.";
      }
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

  const planLabelShort =
    studio.subscription_period === "yearly"
      ? "Pro (Yearly) - $190/year"
      : "Pro (Monthly) - $19/month";

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

      <div className="mt-8 space-y-6">
        {/* Stripe account error */}
        {stripeError && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-amber-800">Billing account issue</h3>
                <p className="mt-1 text-sm text-amber-700">{stripeError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Urgent alert for past_due or grace */}
        {studio.plan_status === "past_due" && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <svg className="mt-0.5 h-5 w-5 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-red-800">Action required: Payment failed</h3>
                <p className="mt-1 text-sm text-red-700">
                  Your last payment was unsuccessful. Please update your payment method to avoid service interruption.
                </p>
              </div>
            </div>
          </div>
        )}
        {studio.plan_status === "grace" && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <svg className="mt-0.5 h-5 w-5 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-red-800">Your studio access is limited</h3>
                <p className="mt-1 text-sm text-red-700">
                  Your subscription payment has failed and your account is in a grace period.
                  {gracePeriodEndsAtFormatted && <> Full access will be suspended on <strong>{gracePeriodEndsAtFormatted}</strong>.</>}
                  {" "}Please update your payment method immediately to restore full access.
                </p>
              </div>
            </div>
          </div>
        )}
        {studio.plan_status === "canceled" && (
          <div className="rounded-lg border border-gray-300 bg-gray-50 p-4">
            <div className="flex items-start gap-3">
              <svg className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Subscription canceled</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Your subscription has been canceled. To continue using Klasly, please resubscribe from the options below.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Current Plan */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900">Current Plan</h2>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-xs text-gray-400">Plan</dt>
              <dd className="text-sm font-medium text-gray-900">
                {planLabelShort}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Status</dt>
              <dd className="text-sm font-medium text-gray-900">{statusLabel}</dd>
            </div>
            {studio.plan_status === "trialing" && trialEndsAtFormatted && (
              <>
                <div>
                  <dt className="text-xs text-gray-400">Trial ends on</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {trialEndsAtFormatted}
                  </dd>
                </div>
                <p className="text-sm text-gray-600">
                  Your trial will convert to {studio.subscription_period === "yearly" ? "Yearly" : "Monthly"} on {trialEndsAtFormatted}.
                </p>
              </>
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
                <dt className="text-xs text-gray-400">Full access suspended on</dt>
                <dd className="text-sm font-medium text-red-600">
                  {gracePeriodEndsAtFormatted}
                </dd>
                <p className="mt-1 text-xs text-gray-500">
                  Update your payment method before this date to restore full access.
                </p>
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
        </div>

        {/* Switch Plan, Payment Method, Promotion Code, Cancel */}
        <BillingActions
          planStatus={studio.plan_status ?? "trialing"}
          subscriptionPeriod={studio.subscription_period ?? "monthly"}
          cancelAtPeriodEnd={!!studio.cancel_at_period_end}
          hasStripeSubscription={!!studio.stripe_subscription_id}
          isYearlyWithinRefundWindow={!!isYearlyWithinRefund}
          appliedCouponCode={appliedCouponCode}
          paymentMethod={paymentMethod}
        />
      </div>
    </div>
  );
}
