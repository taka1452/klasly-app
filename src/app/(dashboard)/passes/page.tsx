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

  // --- Stats ---
  const totalActiveSubscribers = Object.values(subCounts).reduce((sum, n) => sum + n, 0);

  // MRR: sum of price_cents * active subscriber count per pass
  const mrr = (passes ?? []).reduce((sum, pass) => {
    const count = subCounts[pass.id] ?? 0;
    return sum + pass.price_cents * count;
  }, 0);

  // This month's pass bookings
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;

  let passBookingsThisMonth = 0;
  if (passIds.length > 0) {
    const { count } = await ctx.supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", ctx.studioId)
      .eq("booked_via_pass", true)
      .gte("created_at", monthStart)
      .lt("created_at", monthEnd);
    passBookingsThisMonth = count ?? 0;
  }

  // Top 5 members by pass usage this month
  type UsageRow = { member_id: string; members?: { profiles?: { full_name?: string } } };
  let topMembers: { name: string; count: number }[] = [];
  if (passIds.length > 0) {
    const { data: usage } = await ctx.supabase
      .from("pass_class_usage")
      .select("member_id, members(profiles(full_name))")
      .in("studio_pass_id", passIds)
      .gte("used_at", monthStart)
      .lt("used_at", monthEnd);

    if (usage && usage.length > 0) {
      const memberMap = new Map<string, { name: string; count: number }>();
      for (const row of usage as UsageRow[]) {
        const existing = memberMap.get(row.member_id);
        if (existing) {
          existing.count += 1;
        } else {
          const name = row.members?.profiles?.full_name || "Unknown";
          memberMap.set(row.member_id, { name, count: 1 });
        }
      }
      topMembers = Array.from(memberMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    }
  }

  // Check for pending distributions awaiting approval
  const { count: pendingDistCount } = await ctx.supabase
    .from("pass_distributions")
    .select("id", { count: "exact", head: true })
    .eq("studio_id", ctx.studioId)
    .eq("status", "pending");

  return (
    <div>
      {/* Pending distribution alert */}
      {(pendingDistCount ?? 0) > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{pendingDistCount} payout(s)</span> awaiting your approval.
          </p>
          <Link
            href="/passes/distributions"
            className="whitespace-nowrap text-sm font-medium text-amber-700 hover:text-amber-900"
          >
            Review →
          </Link>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Passes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage monthly membership passes for your studio
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/passes/distributions"
            className="btn-secondary"
          >
            Distributions
          </Link>
          <Link
            href="/passes/new"
            className="btn-primary"
          >
            + Create Pass
          </Link>
        </div>
      </div>

      {/* Stats Overview */}
      {passes && passes.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card">
            <p className="text-sm font-medium text-gray-500">Active Subscribers</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{totalActiveSubscribers}</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-500">Pass Bookings (This Month)</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{passBookingsThisMonth}</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-500">Monthly Recurring Revenue</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              ${(mrr / 100).toFixed(2)}
            </p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-500">Top Members (This Month)</p>
            {topMembers.length > 0 ? (
              <ul className="mt-1 space-y-1">
                {topMembers.map((m, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="truncate text-gray-700">{m.name}</span>
                    <span className="ml-2 font-semibold text-gray-900">{m.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-gray-400">No usage yet</p>
            )}
          </div>
        </div>
      )}

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
