import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { stripe } from "@/lib/stripe/server";

export default async function OnboardingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
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
    .select("studio_id")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id) redirect("/onboarding");

  const params = await searchParams;
  const sessionId = params.session_id;

  const { data: studioData } = await supabase
    .from("studios")
    .select("id, trial_ends_at, stripe_subscription_id")
    .eq("id", profile.studio_id)
    .single();

  let studio = studioData;

  // Webhook がまだ来ていない場合、session_id から DB を直接更新
  if (
    !studio?.stripe_subscription_id &&
    sessionId &&
    studio?.id
  ) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription"],
      });
      const subscriptionId =
        session.subscription == null
          ? null
          : typeof session.subscription === "string"
            ? session.subscription
            : (session.subscription as { id: string }).id;
      const studioId = session.metadata?.studio_id;

      if (subscriptionId && studioId === studio.id) {
        const sub =
          typeof session.subscription === "object" && session.subscription
            ? session.subscription
            : await stripe.subscriptions.retrieve(subscriptionId);

        if (sub) {
          const priceId = sub.items.data[0]?.price?.id ?? "";
          const period: "monthly" | "yearly" =
            priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID
              ? "yearly"
              : "monthly";

          const trialEnd = sub.trial_end;
          const trialEndAt = trialEnd
            ? new Date(trialEnd * 1000).toISOString()
            : null;

          const periodEnd = sub.items.data[0]?.current_period_end;
          const currentPeriodEnd = periodEnd
            ? new Date(periodEnd * 1000).toISOString()
            : null;

          await supabase
            .from("studios")
            .update({
              stripe_subscription_id: subscriptionId,
              plan: "pro",
              plan_status: "trialing",
              trial_ends_at: trialEndAt,
              subscription_period: period,
              current_period_end: currentPeriodEnd,
              cancel_at_period_end: sub.cancel_at_period_end ?? false,
            })
            .eq("id", studio.id);

          studio = {
            ...studio,
            trial_ends_at: trialEndAt,
          };
        }
      }
    } catch {
      // Stripe API エラー時は無視（Webhook に任せる）
    }
  }

  const trialEndStr = studio?.trial_ends_at
    ? new Date(studio.trial_ends_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(
        "en-US",
        { month: "long", day: "numeric", year: "numeric" }
      );

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome to Klasly! Your 30-day trial has started.
        </h1>
        <p className="mt-4 text-gray-600">
          Your trial ends on <strong>{trialEndStr}</strong>. You won&apos;t be
          charged until then.
        </p>
        <Link
          href={sessionId ? `/onboarding/complete?session_id=${encodeURIComponent(sessionId)}` : "/dashboard"}
          className="btn-primary mt-8 inline-block"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
