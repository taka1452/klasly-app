import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ProductManager from "@/components/settings/product-manager";
import type { Product } from "@/types/database";

/*
 * オーナーがスタジオの商品（料金プラン）を作成・編集・無効化する画面。
 * 固定4プランは廃止し、products テーブルを利用する。
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

  if (!profile?.studio_id || (profile.role !== "owner" && profile.role !== "manager")) redirect("/");

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("studio_id", profile.studio_id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const initialProducts = (products ?? []) as Product[];

  return (
    <div>
      <Link
        href="/settings"
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        ← Back to Settings
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-gray-900">
        Products &amp; Pricing
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Create and manage the plans and packages available to your members.
      </p>

      <ProductManager initialProducts={initialProducts} />
    </div>
  );
}
