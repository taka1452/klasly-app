import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import PricingForm from "@/components/settings/pricing-form";

/*
 * オーナーが自分のスタジオの料金を設定
 * - Drop-in: 1回あたり
 * - 5-Class Pack: 5回分
 * - 10-Class Pack: 10回分
 * - Monthly: 月額無制限
 * Stripe Product は会員が購入時に動的に作成
 */

export default async function PricingPage() {
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
      "id, drop_in_price, pack_5_price, pack_10_price, monthly_price"
    )
    .eq("id", profile.studio_id)
    .single();

  if (!studio) redirect("/");

  const defaults = {
    drop_in_price: studio.drop_in_price ?? 2000,
    pack_5_price: studio.pack_5_price ?? 8000,
    pack_10_price: studio.pack_10_price ?? 15000,
    monthly_price: studio.monthly_price ?? 12000,
  };

  return (
    <div>
      <Link
        href="/settings"
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        ← Back to Settings
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-gray-900">Class Pricing</h1>
      <p className="mt-1 text-sm text-gray-500">
        Set prices for drop-in, class packs, and monthly membership.
      </p>

      <PricingForm studioId={studio.id} defaults={defaults} />
    </div>
  );
}
