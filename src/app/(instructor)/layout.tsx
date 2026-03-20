import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import InstructorShell from "@/components/ui/instructor-shell";
import DevRoleSwitcher from "@/components/ui/dev-role-switcher";
import { getStudioFeatures } from "@/lib/features/check-feature";
import { FeatureProvider } from "@/lib/features/feature-context";
import AnnouncementBanner from "@/components/announcements/announcement-banner";

export default async function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminSupabase = serviceRoleKey
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
      )
    : supabase;

  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("role, full_name, studio_id, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (profile?.role === "owner") {
    redirect("/");
  }

  if (profile?.role === "member") {
    redirect("/schedule");
  }

  if (profile?.role !== "instructor") {
    redirect("/login");
  }

  if (!profile?.studio_id) {
    redirect("/login");
  }

  // instructors テーブルにレコードがあるか確認
  const { data: instructorRecord } = await adminSupabase
    .from("instructors")
    .select("id")
    .eq("profile_id", user.id)
    .eq("studio_id", profile.studio_id)
    .maybeSingle();

  const { data: studio } = await adminSupabase
    .from("studios")
    .select("name")
    .eq("id", profile.studio_id)
    .single();

  const studioName = (studio as { name?: string })?.name || "Studio";
  const userName = profile.full_name || user.email || "Instructor";
  const userEmail = user.email || "";
  const onboardingCompleted =
    (profile as { onboarding_completed?: boolean })?.onboarding_completed ?? true;
  const onboardingStep =
    (profile as { onboarding_step?: number })?.onboarding_step ?? 0;
  const onboardingStartedAt =
    (profile as { onboarding_started_at?: string | null })?.onboarding_started_at ?? null;

  const features = await getStudioFeatures(profile.studio_id);

  // instructors レコードがない場合、エラーメッセージを表示
  if (!instructorRecord) {
    return (
      <FeatureProvider features={features}>
        <AnnouncementBanner />
        <InstructorShell
          studioName={studioName}
          userName={userName}
          userEmail={userEmail}
          onboardingCompleted={onboardingCompleted}
          onboardingStep={onboardingStep}
          onboardingStartedAt={onboardingStartedAt}
          userId={user.id}
        >
          <div className="flex items-center justify-center py-20">
            <div className="max-w-md text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Instructor Setup Incomplete</h2>
              <p className="mt-2 text-sm text-gray-600">
                Your instructor profile has not been set up yet. Please contact the studio owner to complete your instructor registration.
              </p>
            </div>
          </div>
          <DevRoleSwitcher />
        </InstructorShell>
      </FeatureProvider>
    );
  }

  return (
    <FeatureProvider features={features}>
      <AnnouncementBanner />
      <InstructorShell
        studioName={studioName}
        userName={userName}
        userEmail={userEmail}
        onboardingCompleted={onboardingCompleted}
        onboardingStep={onboardingStep}
        onboardingStartedAt={onboardingStartedAt}
        userId={user.id}
      >
        {children}
        <DevRoleSwitcher />
      </InstructorShell>
    </FeatureProvider>
  );
}
