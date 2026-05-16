import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate, getDayName, formatTime } from "@/lib/utils";
import InstructorEditForm from "@/components/instructors/instructor-edit-form";
import InstructorDeleteButton from "@/components/instructors/instructor-delete-button";
import InstructorContracts from "@/components/instructors/instructor-contracts";
import InstructorManagerToggle from "@/components/instructors/instructor-manager-toggle";

export default async function InstructorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
      )
    : serverSupabase;

  const { data: instructor } = await supabase
    .from("instructors")
    .select("*, profiles(full_name, email, phone, avatar_url)")
    .eq("id", id)
    .single();

  if (!instructor) {
    notFound();
  }

  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();

  if (ownerProfile?.studio_id !== instructor.studio_id) {
    notFound();
  }

  // Fetch tiers and current membership for this instructor
  const { data: tiers } = await supabase
    .from("instructor_membership_tiers")
    .select("id, name, monthly_minutes, monthly_price, allow_overage, overage_rate_cents")
    .eq("studio_id", instructor.studio_id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const { data: membership } = await supabase
    .from("instructor_memberships")
    .select("tier_id, stripe_subscription_id, cancel_at_period_end, current_period_end, instructor_membership_tiers(name, monthly_price, monthly_minutes, allow_overage, overage_rate_cents)")
    .eq("instructor_id", id)
    .eq("status", "active")
    .maybeSingle();

  // Current-month usage so the admin can see "X hr used / Y hr remaining"
  // without waiting for month-end billing. Sums duration_minutes from
  // class_sessions taught by this instructor in the current calendar month.
  // (Cancelled sessions excluded — matches the rental report logic.)
  let monthlyUsedMinutes = 0;
  if (membership?.tier_id) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

    const { data: monthSessions } = await supabase
      .from("class_sessions")
      .select("duration_minutes")
      .eq("instructor_id", id)
      .gte("session_date", monthStart)
      .lt("session_date", monthEnd)
      .eq("is_cancelled", false);

    if (monthSessions) {
      for (const s of monthSessions) {
        monthlyUsedMinutes += s.duration_minutes ?? 0;
      }
    }
  }

  const [{ data: assignedClasses }, { data: assignedTemplates }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, day_of_week, start_time")
      .eq("instructor_id", id)
      .eq("is_active", true)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase
      .from("class_templates")
      .select("id, name, duration_minutes")
      .eq("instructor_id", id)
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  const profileData = instructor.profiles as {
    full_name?: string;
    email?: string;
    phone?: string;
    avatar_url?: string;
  } | null;
  const rawProfile = Array.isArray(profileData) ? profileData[0] : profileData;
  const specialties = instructor.specialties as string[] | null;

  // Check if this is a test account
  let testAccountInfo: { email: string; password: string } | null = null;
  if (serviceRoleKey) {
    const { data: authData } = await supabase.auth.admin.getUserById(instructor.profile_id);
    const meta = authData?.user?.user_metadata;
    if (meta?.is_test_account && meta?.default_password) {
      testAccountInfo = {
        email: rawProfile?.email || "",
        password: meta.default_password as string,
      };
    }
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/instructors"
          className="group inline-flex items-center gap-1 text-sm font-medium text-brand-600 transition-colors duration-150 hover:text-brand-700"
        >
          <span className="inline-block transition-transform duration-150 ease-out group-hover:-translate-x-0.5">
            &larr;
          </span>
          Instructors
        </Link>
      </div>
      <div className="mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            {rawProfile?.full_name || "Unknown"}
          </h1>
          {specialties && specialties.length > 0 && (
            <p className="mt-1 text-sm text-gray-500">
              {specialties.join(", ")}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <InstructorEditForm
            instructorId={instructor.id}
            profileId={instructor.profile_id}
            tiers={tiers || []}
            initialData={{
              fullName: rawProfile?.full_name || "",
              phone: rawProfile?.phone || "",
              bio: instructor.bio || "",
              specialties: (specialties || []).join(", "),
              websiteUrl: (instructor as { website_url?: string }).website_url || "",
              rentalType: (instructor as { rental_type?: string }).rental_type as "none" | "flat_monthly" | "per_class" | "per_hour" ?? "none",
              rentalAmount: (instructor as { rental_amount?: number }).rental_amount ?? 0,
              tierId: membership?.tier_id || "",
              avatarUrl: rawProfile?.avatar_url || "",
            }}
          />
        </div>

        <div className="space-y-6">
          {testAccountInfo && (
            <div className="card border-amber-200 bg-amber-50">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                <span>🔑</span> Test Account
              </div>
              <dl className="mt-3 space-y-2">
                <div>
                  <dt className="text-xs text-amber-600">Email</dt>
                  <dd className="text-sm font-mono text-amber-900">{testAccountInfo.email}</dd>
                </div>
                <div>
                  <dt className="text-xs text-amber-600">Password</dt>
                  <dd className="text-sm font-mono text-amber-900">{testAccountInfo.password}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-amber-600">
                Log in with these credentials to preview the instructor experience.
              </p>
            </div>
          )}

          <div className="card">
            <h3 className="text-sm font-medium text-gray-500">
              Instructor Info
            </h3>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-xs text-gray-400">Email</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {rawProfile?.email || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Phone</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {rawProfile?.phone || "—"}
                </dd>
              </div>
              {(instructor as { website_url?: string }).website_url && (
                <div>
                  <dt className="text-xs text-gray-400">Website</dt>
                  <dd className="text-sm font-medium text-gray-900 break-all">
                    <a
                      href={(instructor as { website_url?: string }).website_url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:text-brand-700"
                    >
                      {(instructor as { website_url?: string }).website_url}
                    </a>
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-gray-400">Joined</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {formatDate(instructor.created_at)}
                </dd>
              </div>
            </dl>
          </div>

          {membership && (() => {
            const rawTier = membership.instructor_membership_tiers as unknown;
            const tierInfo = (Array.isArray(rawTier) ? rawTier[0] : rawTier) as {
              name: string;
              monthly_price: number;
              monthly_minutes?: number;
              allow_overage?: boolean | null;
              overage_rate_cents?: number | null;
            } | null;
            if (!tierInfo) return null;
            const hasSubscription = !!membership.stripe_subscription_id;
            const isFree = tierInfo.monthly_price <= 0;
            const tierMinutes = tierInfo.monthly_minutes ?? 0;
            const unlimited = tierMinutes === -1;
            const remainingMinutes = unlimited
              ? null
              : Math.max(0, tierMinutes - monthlyUsedMinutes);
            const overMinutes =
              unlimited || tierMinutes === 0
                ? 0
                : Math.max(0, monthlyUsedMinutes - tierMinutes);
            const usagePct =
              unlimited || tierMinutes === 0
                ? 0
                : Math.min(
                    100,
                    Math.round((monthlyUsedMinutes / tierMinutes) * 100)
                  );
            const formatMinutes = (mins: number) => {
              const h = Math.floor(mins / 60);
              const m = mins % 60;
              if (h === 0) return `${m}min`;
              if (m === 0) return `${h}h`;
              return `${h}h ${m}min`;
            };
            const estimatedOverageCents =
              overMinutes > 0 && tierInfo.allow_overage && tierInfo.overage_rate_cents
                ? Math.round((overMinutes / 60) * tierInfo.overage_rate_cents)
                : 0;
            const monthLabel = new Date().toLocaleString("en-US", {
              month: "long",
              year: "numeric",
            });
            return (
              <div className="card">
                <h3 className="text-sm font-medium text-gray-500">
                  Membership Tier
                </h3>
                <dl className="mt-4 space-y-3">
                  <div>
                    <dt className="text-xs text-gray-400">Tier</dt>
                    <dd className="text-sm font-medium text-gray-900">{tierInfo.name}</dd>
                  </div>
                  {tierInfo.monthly_price > 0 && (
                    <div>
                      <dt className="text-xs text-gray-400">Monthly Price</dt>
                      <dd className="text-sm font-medium text-gray-900">
                        ${(tierInfo.monthly_price / 100).toFixed(2)}/mo
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs text-gray-400">Payment Status</dt>
                    <dd className="mt-0.5">
                      {isFree ? (
                        <span className="inline-flex items-center rounded-full bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-500">Free</span>
                      ) : hasSubscription ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Active</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">Not subscribed</span>
                      )}
                      {membership.cancel_at_period_end && (
                        <span className="ml-1 inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">Cancelling</span>
                      )}
                    </dd>
                  </div>

                  <div className="border-t border-gray-100 pt-3">
                    <dt className="text-xs text-gray-400">
                      Hours this month
                      <span className="ml-1 text-gray-300">({monthLabel})</span>
                    </dt>
                    {unlimited ? (
                      <dd className="mt-1 text-sm font-medium text-gray-900">
                        {formatMinutes(monthlyUsedMinutes)} used · Unlimited
                      </dd>
                    ) : (
                      <>
                        <dd className="mt-1 text-sm font-medium text-gray-900">
                          {formatMinutes(monthlyUsedMinutes)} used of{" "}
                          {formatMinutes(tierMinutes)}
                          {remainingMinutes !== null && remainingMinutes > 0 && (
                            <span className="ml-1 font-normal text-gray-500">
                              · {formatMinutes(remainingMinutes)} left
                            </span>
                          )}
                        </dd>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full transition-all ${
                              overMinutes > 0
                                ? "bg-amber-500"
                                : usagePct >= 80
                                  ? "bg-amber-400"
                                  : "bg-brand-500"
                            }`}
                            style={{ width: `${usagePct}%` }}
                          />
                        </div>
                        {overMinutes > 0 && (
                          <p className="mt-1.5 text-xs text-amber-700">
                            {formatMinutes(overMinutes)} over.
                            {estimatedOverageCents > 0 &&
                              ` Estimated overage $${(
                                estimatedOverageCents / 100
                              ).toFixed(2)} at month-end.`}
                            {tierInfo.allow_overage === false &&
                              " Overage not allowed on this plan — further bookings will be blocked."}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </dl>
              </div>
            );
          })()}

          <div className="card">
            <h3 className="text-sm font-medium text-gray-500">
              Assigned Classes
            </h3>
            {(assignedClasses && assignedClasses.length > 0) || (assignedTemplates && assignedTemplates.length > 0) ? (
              <ul className="mt-4 space-y-2">
                {assignedTemplates?.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <Link
                      href={`/classes/${t.id}`}
                      className="font-medium text-brand-600 hover:text-brand-700"
                    >
                      {t.name}
                    </Link>
                    <span className="text-gray-500">
                      {t.duration_minutes} min
                    </span>
                  </li>
                ))}
                {assignedClasses?.map((cls) => (
                  <li
                    key={cls.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <Link
                      href={`/calendar/${cls.id}`}
                      className="font-medium text-brand-600 hover:text-brand-700"
                    >
                      {cls.name}
                    </Link>
                    <span className="text-gray-500">
                      {getDayName(cls.day_of_week)} · {formatTime(cls.start_time)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-gray-500">No classes assigned</p>
            )}
          </div>

          {ownerProfile?.role === "owner" && (
            <InstructorManagerToggle instructorId={instructor.id} />
          )}

          <InstructorContracts instructorId={instructor.id} />

          <div className="card">
            <h3 className="text-sm font-medium text-red-600">Danger Zone</h3>
            <p className="mt-2 text-xs text-gray-500">
              Permanently remove this instructor. Assigned classes will be
              unassigned.
            </p>
            <InstructorDeleteButton instructorId={instructor.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
