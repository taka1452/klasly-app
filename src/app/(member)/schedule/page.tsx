import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getPlanAccess } from "@/lib/plan-guard";
import { getRequiresCredits } from "@/lib/booking-utils";
import ScheduleCalendar from "@/components/member/calendar/schedule-calendar";

export default async function SchedulePage() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return null;
  }

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

  if (!profile?.studio_id) {
    return (
      <div className="card">
        <p className="text-sm text-gray-500">
          You are not a member of any studio. Contact your studio to get access.
        </p>
      </div>
    );
  }

  let memberId: string | null = null;
  let memberCredits = 0;
  let planStatus = "trialing";
  let requiresCredits = true;
  let payoutModel = "studio";
  let dropInPrice: number | null = null;

  const { data: memberData } = await supabase
    .from("members")
    .select("id, credits, waiver_signed")
    .eq("studio_id", profile.studio_id)
    .eq("profile_id", user.id)
    .single();

  if (memberData) {
    memberId = memberData.id;
    memberCredits = memberData.credits;
  }

  const { data: studio } = await supabase
    .from("studios")
    .select("plan_status, booking_requires_credits, stripe_connect_onboarding_complete, payout_model")
    .eq("id", profile.studio_id)
    .single();
  planStatus = studio?.plan_status ?? "trialing";
  payoutModel = (studio as { payout_model?: string })?.payout_model ?? "studio";

  requiresCredits = getRequiresCredits({
    booking_requires_credits: (studio as { booking_requires_credits?: boolean | null })?.booking_requires_credits ?? null,
    stripe_connect_onboarding_complete: (studio as { stripe_connect_onboarding_complete?: boolean })?.stripe_connect_onboarding_complete ?? false,
  });

  // Get drop-in price for pay-per-class mode
  if (payoutModel === "instructor_direct") {
    const { data: dropInProduct } = await supabase
      .from("products")
      .select("price")
      .eq("studio_id", profile.studio_id)
      .eq("is_active", true)
      .eq("type", "one_time")
      .order("sort_order", { ascending: true })
      .limit(1)
      .single();
    dropInPrice = dropInProduct?.price ?? null;
  }

  const planAccess = getPlanAccess(planStatus);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
      <p className="mt-1 mb-4 text-sm text-gray-500">
        Book your classes
      </p>

      <ScheduleCalendar
        memberId={memberId}
        memberCredits={memberCredits}
        canBook={planAccess.canBook}
        requiresCredits={requiresCredits}
        payPerClass={payoutModel === "instructor_direct"}
        classPrice={dropInPrice ?? undefined}
      />
    </div>
  );
}
