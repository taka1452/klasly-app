import { redirect } from "next/navigation";
import Link from "next/link";
import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import PassAutoDistributeToggle from "@/components/passes/pass-auto-distribute-toggle";

export default async function PassesPage() {
  const ctx = await getDashboardContext();
  if (!ctx) redirect("/login");

  const enabled = await isFeatureEnabled(ctx.studioId, FEATURE_KEYS.STUDIO_PASS);
  if (!enabled) redirect("/dashboard");

  const { data: passes } = await ctx.supabase
    .from("studio_passes")
    .select("id, name, description, price_cents, max_classes_per_month, auto_distribute, is_active, created_at")
    .eq("studio_id", ctx.studioId)
    .order("created_at", { ascending: false });

  // Count active subscriptions per pass
  const passIds = (passes ?? []).map((p) => p.id);
  let subCounts: Record<string, number> = {};
  if (passIds.length > 0) {
    const { data: subs } = await ctx.supabase
      .from("pass_subscriptions")
      .select("studio_pass_id")
      .in("studio_pass_id", passIds)
      .eq("status", "active");

    if (subs) {
      for (const s of subs) {
        subCounts[s.studio_pass_id] = (subCounts[s.studio_pass_id] ?? 0) + 1;
      }
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Passes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage monthly membership passes for your studio
          </p>
        </div>
        <Link
          href="/passes/new"
          className="btn-primary"
        >
          + Create Pass
        </Link>
      </div>

      {(!passes || passes.length === 0) ? (
        <div className="mt-6 card">
          <p className="text-sm text-gray-500">
            No passes yet. Create your first pass to offer monthly memberships.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {passes.map((pass) => (
            <div key={pass.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">{pass.name}</h3>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        pass.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {pass.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {pass.description && (
                    <p className="mt-1 text-sm text-gray-500">{pass.description}</p>
                  )}
                </div>
                <p className="text-lg font-bold text-gray-900">
                  ${(pass.price_cents / 100).toFixed(2)}
                  <span className="text-sm font-normal text-gray-500">/month</span>
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-6 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Classes/month:</span>{" "}
                  {pass.max_classes_per_month === null ? "Unlimited" : pass.max_classes_per_month}
                </div>
                <div>
                  <span className="font-medium">Active subscribers:</span>{" "}
                  {subCounts[pass.id] ?? 0}
                </div>
                <PassAutoDistributeToggle
                  passId={pass.id}
                  initialValue={pass.auto_distribute}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
