import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { stripe } from "@/lib/stripe/server";

/**
 * オンボーディング完了ページ。
 *
 * 2つのケースを処理:
 * 1. 新フロー: session_id なし → トライアルを自動開始してダッシュボードへ
 * 2. 旧フロー/Stripe決済後: session_id あり → Stripe DB同期してダッシュボードへ
 */
export default async function OnboardingCompletePage({
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

  if (sessionId) {
    // Stripe決済経由（Settings > Billing からプラン選択した場合）
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

      if (subscriptionId && studioId === profile.studio_id) {
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
            .eq("id", profile.studio_id);
        }
      }
    } catch {
      // エラー時もダッシュボードへ（Webhook で更新される可能性）
    }
  } else {
    // 新フロー: Stripeなしでトライアル自動開始
    const { data: studio } = await supabase
      .from("studios")
      .select("plan_status")
      .eq("id", profile.studio_id)
      .single();

    // まだプランが設定されていない場合のみトライアルを開始
    if (!studio?.plan_status || studio.plan_status === "none") {
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 30);

      await supabase
        .from("studios")
        .update({
          plan: "pro",
          plan_status: "trialing",
          trial_ends_at: trialEndsAt.toISOString(),
        })
        .eq("id", profile.studio_id);
    }
  }

  redirect("/dashboard");
}
