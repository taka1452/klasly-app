import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PurchaseOptions from "@/components/purchase/purchase-options";

export default async function PurchasePage() {
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

  const { data: memberList } = await supabase
    .from("members")
    .select("id, studio_id")
    .eq("profile_id", user.id);

  const member = memberList?.[0];
  if (!member) {
    return (
      <div className="card">
        <p className="text-sm text-gray-500">
          You are not a member of any studio. Contact your studio to get access.
        </p>
      </div>
    );
  }

  const { data: studio } = await supabase
    .from("studios")
    .select(
      "id, drop_in_price, pack_5_price, pack_10_price, monthly_price"
    )
    .eq("id", member.studio_id)
    .single();

  if (!studio) {
    return (
      <div className="card">
        <p className="text-sm text-gray-500">Studio not found.</p>
      </div>
    );
  }

  const pricing = {
    drop_in_price: studio.drop_in_price ?? 2000,
    pack_5_price: studio.pack_5_price ?? 8000,
    pack_10_price: studio.pack_10_price ?? 15000,
    monthly_price: studio.monthly_price ?? 12000,
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Purchase Options</h1>
      <p className="mt-1 text-sm text-gray-500">
        Buy credits or monthly membership
      </p>

      <PurchaseOptions memberId={member.id} pricing={pricing} />
    </div>
  );
}
