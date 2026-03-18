import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPlanAccess } from "@/lib/plan-guard";
import MemberPasses from "@/components/passes/member-passes";

export default async function MemberPassesPage() {
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
      "id, plan_status, stripe_connect_account_id, stripe_connect_onboarding_complete"
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

  const planAccess = getPlanAccess(studio.plan_status ?? "trialing");

  if (!planAccess.canPurchase) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Membership Passes</h1>
        <p className="mt-1 text-sm text-gray-500">
          Monthly membership plans for this studio
        </p>
        <div className="mt-6 card">
          <p className="text-amber-600">
            Purchases are temporarily unavailable. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  if (
    !studio.stripe_connect_account_id ||
    !studio.stripe_connect_onboarding_complete
  ) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Membership Passes</h1>
        <p className="mt-1 text-sm text-gray-500">
          Monthly membership plans for this studio
        </p>
        <div className="mt-6 card">
          <p className="text-amber-600">
            Online payments are not yet available for this studio. Please
            contact the studio owner.
          </p>
        </div>
      </div>
    );
  }

  // Fetch active passes
  const { data: passes } = await supabase
    .from("studio_passes")
    .select("id, name, description, price_cents, max_classes_per_month")
    .eq("studio_id", member.studio_id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  // Fetch member's active subscriptions
  const { data: subscriptions } = await supabase
    .from("pass_subscriptions")
    .select("id, studio_pass_id, status, current_period_start, current_period_end, classes_used_this_period")
    .eq("member_id", member.id)
    .in("status", ["active", "cancelled"]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Membership Passes</h1>
      <p className="mt-1 text-sm text-gray-500">
        Monthly membership plans for this studio
      </p>

      <MemberPasses
        memberId={member.id}
        passes={passes ?? []}
        subscriptions={subscriptions ?? []}
      />
    </div>
  );
}
