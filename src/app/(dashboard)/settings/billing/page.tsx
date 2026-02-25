import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { stripe } from "@/lib/stripe/server";
import { PLAN_MEMBER_LIMITS } from "@/lib/plan-limits";
import BillingActions from "@/components/settings/billing-actions";

/*
 * Stripe Dashboard で以下の Product を作成する必要がある:
 * - Product名: Klasly Studio Plan → Price: $19/month (recurring)
 * - Product名: Klasly Grow Plan → Price: $39/month (recurring)
 * 各PriceのIDを環境変数に追加:
 * STRIPE_STUDIO_PRICE_ID=price_xxx
 * STRIPE_GROW_PRICE_ID=price_xxx
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
      "id, plan, plan_status, stripe_customer_id, stripe_subscription_id"
    )
    .eq("id", profile.studio_id)
    .single();

  if (!studio) redirect("/");

  const { count } = await supabase
    .from("members")
    .select("*", { count: "exact", head: true })
    .eq("studio_id", studio.id);

  const memberCount = count ?? 0;
  const limit =
    studio.plan && studio.plan in PLAN_MEMBER_LIMITS
      ? PLAN_MEMBER_LIMITS[studio.plan]
      : 10;
  const limitLabel = limit === Infinity ? "Unlimited" : limit;

  let nextBillingDate: string | null = null;
  let cardLast4: string | null = null;

  if (studio.stripe_subscription_id) {
    try {
      const sub = await stripe.subscriptions.retrieve(
        studio.stripe_subscription_id,
        { expand: ["default_payment_method"] }
      );
      const periodEnd = sub.items?.data?.[0]?.current_period_end;
      if (periodEnd) {
        nextBillingDate = new Date(periodEnd * 1000).toLocaleDateString();
      }
      const pm = sub.default_payment_method as { card?: { last4?: string } } | null;
      if (pm?.card?.last4) cardLast4 = pm.card.last4;
    } catch {
      // ignore Stripe errors
    }
  }

  const hasActiveSubscription = !!(
    studio.stripe_subscription_id &&
    ["active", "past_due", "cancelled"].includes(studio.plan_status ?? "")
  );

  const planLabel =
    studio.plan === "studio"
      ? "Studio"
      : studio.plan === "grow"
      ? "Grow"
      : "Free";

  const statusLabel =
    studio.plan_status === "past_due"
      ? "Past Due"
      : studio.plan_status === "cancelled"
      ? "Cancelling at period end"
      : "Active";

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
            <dd className="text-sm font-medium text-gray-900">{planLabel}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Status</dt>
            <dd className="text-sm font-medium text-gray-900">{statusLabel}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Members</dt>
            <dd className="text-sm font-medium text-gray-900">
              {memberCount} / {limitLabel}
            </dd>
          </div>
          {nextBillingDate && (
            <div>
              <dt className="text-xs text-gray-400">Next billing date</dt>
              <dd className="text-sm font-medium text-gray-900">
                {nextBillingDate}
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
        </dl>

        <div className="mt-6">
          <BillingActions
            plan={studio.plan ?? "free"}
            studioPriceId={process.env.STRIPE_STUDIO_PRICE_ID}
            growPriceId={process.env.STRIPE_GROW_PRICE_ID}
            hasActiveSubscription={hasActiveSubscription}
          />
        </div>
      </div>
    </div>
  );
}
