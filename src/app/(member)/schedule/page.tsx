import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { getPlanAccess } from "@/lib/plan-guard";
import { getRequiresCredits } from "@/lib/booking-utils";
import ScheduleCalendar from "@/components/member/calendar/schedule-calendar";
import UTMTracker from "@/components/tracking/utm-tracker";

export default async function SchedulePage() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    redirect("/login");
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
    .select("studio_id, onboarding_completed")
    .eq("id", user.id)
    .single();

  const onboardingCompleted = (profile as { onboarding_completed?: boolean })?.onboarding_completed ?? true;

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
      <UTMTracker studioId={profile.studio_id} />

      {/* First-time welcome */}
      {!onboardingCompleted && (
        <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50 p-5">
          <h2 className="text-base font-semibold text-brand-900">
            Welcome!
          </h2>
          <p className="mt-1 text-sm text-brand-700 leading-relaxed">
            Here&apos;s how to get started:
          </p>
          <ol className="mt-3 space-y-2 text-sm text-brand-700">
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-200 text-xs font-bold text-brand-800">1</span>
              <span>Browse the <strong>Schedule</strong> to find classes you like</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-200 text-xs font-bold text-brand-800">2</span>
              <span>Click <strong>Book</strong> to reserve your spot</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-200 text-xs font-bold text-brand-800">3</span>
              <span>Check <strong>My Bookings</strong> to see your upcoming classes</span>
            </li>
          </ol>
          <Link
            href="/help/member-guide/member-book-class"
            className="mt-3 inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Detailed booking guide
          </Link>
        </div>
      )}

      <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Schedule</h1>
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
