import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import { getStripe } from "@/lib/stripe/server";
import Link from "next/link";
import AdminStudioDetail from "@/components/admin/admin-studio-detail";

const STRIPE_DASHBOARD = "https://dashboard.stripe.com";

async function getAppliedCoupon(subscriptionId: string | null): Promise<{ id: string; name: string } | null> {
  if (!subscriptionId) return null;
  try {
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["discounts.promotion_code"] });
    const first = Array.isArray(sub.discounts) && sub.discounts.length > 0 ? sub.discounts[0] : null;
    const discount = first && typeof first === "object" ? first : null;
    const promo = discount && "promotion_code" in discount && discount.promotion_code
      ? (typeof discount.promotion_code === "object" ? discount.promotion_code as { id: string; code?: string } : null)
      : null;
    if (!promo?.id) return null;
    return { id: promo.id, name: promo.code ?? promo.id };
  } catch {
    return null;
  }
}

export default async function AdminStudioDetailPage({
  params,
}: {
  params: Promise<{ studioId: string }>;
}) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { studioId } = await params;

  const { data: studio, error: studioError } = await supabase
    .from("studios")
    .select("*")
    .eq("id", studioId)
    .single();

  if (studioError || !studio) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
        <p className="text-red-400">Studio not found</p>
        <Link href="/admin/studios" className="mt-2 inline-block text-sm text-indigo-400 hover:text-indigo-300">
          ← Back to Studios
        </Link>
      </div>
    );
  }

  const { data: owner } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("studio_id", studioId)
    .eq("role", "owner")
    .single();

  const [{ count: membersActive }, { count: membersPaused }, { count: membersCancelled }, { count: instructorsCount }, { count: classesActive }, { count: membersTotal }, { count: waiverSigned }] = await Promise.all([
    supabase.from("members").select("id", { count: "exact", head: true }).eq("studio_id", studioId).eq("status", "active"),
    supabase.from("members").select("id", { count: "exact", head: true }).eq("studio_id", studioId).eq("status", "paused"),
    supabase.from("members").select("id", { count: "exact", head: true }).eq("studio_id", studioId).eq("status", "cancelled"),
    supabase.from("instructors").select("id", { count: "exact", head: true }).eq("studio_id", studioId),
    supabase.from("classes").select("id", { count: "exact", head: true }).eq("studio_id", studioId).eq("is_active", true),
    supabase.from("members").select("id", { count: "exact", head: true }).eq("studio_id", studioId),
    supabase.from("members").select("id", { count: "exact", head: true }).eq("studio_id", studioId).eq("waiver_signed", true),
  ]);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [{ count: bookings30d }, { count: attended30d }, { count: dropIn30d }] = await Promise.all([
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("studio_id", studioId).gte("created_at", thirtyDaysAgo),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("studio_id", studioId).eq("attended", true).gte("created_at", thirtyDaysAgo),
    supabase.from("drop_in_attendances").select("id", { count: "exact", head: true }).eq("studio_id", studioId).gte("attended_at", thirtyDaysAgo),
  ]);

  const { data: payments } = await supabase
    .from("payments")
    .select("id, amount, type, status, paid_at, created_at, stripe_payment_intent_id")
    .eq("studio_id", studioId)
    .order("created_at", { ascending: false })
    .limit(10);

  const studioWithOwner = {
    ...studio,
    owner_name: owner?.full_name ?? null,
    owner_email: owner?.email ?? null,
  };

  const usage = {
    members_active: membersActive ?? 0,
    members_paused: membersPaused ?? 0,
    members_cancelled: membersCancelled ?? 0,
    instructors: instructorsCount ?? 0,
    active_classes: classesActive ?? 0,
    bookings_30d: bookings30d ?? 0,
    attendance_30d: (attended30d ?? 0) + (dropIn30d ?? 0),
    waiver_signed: waiverSigned ?? 0,
    waiver_total: membersTotal ?? 0,
  };

  const stripeCustomerId = studio.stripe_customer_id as string | null;
  const stripeSubscriptionId = studio.stripe_subscription_id as string | null;
  const appliedCoupon = await getAppliedCoupon(stripeSubscriptionId);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/studios" className="text-sm text-slate-400 hover:text-white">
          ← Back to Studios
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">{studio.name}</h1>
      </div>

      <AdminStudioDetail
        studio={studioWithOwner}
        usage={usage}
        payments={payments ?? []}
        stripeCustomerUrl={stripeCustomerId ? `${STRIPE_DASHBOARD}/customers/${stripeCustomerId}` : null}
        stripeSubscriptionUrl={stripeSubscriptionId ? `${STRIPE_DASHBOARD}/subscriptions/${stripeSubscriptionId}` : null}
        appliedCoupon={appliedCoupon}
      />
    </div>
  );
}
