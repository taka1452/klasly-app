import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import WaiverGate from "@/components/waiver/waiver-gate";
import MemberShell from "@/components/member/member-shell";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
    .select("full_name, role, studio_id, onboarding_completed, onboarding_step, onboarding_started_at")
    .eq("id", user.id)
    .single();

  if (profile?.role === "owner") {
    redirect("/dashboard");
  }
  if (profile?.role === "instructor") {
    redirect("/instructor");
  }

  if (!profile?.studio_id) {
    redirect("/onboarding");
  }

  // Waiver gate
  const [memberRes, templateRes] = await Promise.all([
    supabase
      .from("members")
      .select("waiver_signed, is_minor, date_of_birth")
      .eq("profile_id", user.id)
      .eq("studio_id", profile.studio_id)
      .maybeSingle(),
    supabase
      .from("waiver_templates")
      .select("id, title, content")
      .eq("studio_id", profile.studio_id)
      .maybeSingle(),
  ]);

  // A member who was flagged as minor but has now turned 18 needs to re-sign
  // as an adult — the prior guardian signature no longer applies.
  const memberRow = memberRes.data as
    | { waiver_signed?: boolean; is_minor?: boolean; date_of_birth?: string | null }
    | null;
  const agedOutOfMinor = (() => {
    if (!memberRow?.is_minor || !memberRow.date_of_birth) return false;
    const birth = new Date(memberRow.date_of_birth);
    const ageMs = Date.now() - birth.getTime();
    return ageMs / (365.25 * 24 * 60 * 60 * 1000) >= 18;
  })();

  const needsWaiver =
    !!templateRes.data &&
    !!memberRow &&
    (!memberRow.waiver_signed || agedOutOfMinor);

  if (needsWaiver) {
    return <WaiverGate needsWaiver>{children}</WaiverGate>;
  }

  return (
    <MemberShell
      userId={user.id}
      userEmail={user.email || ""}
      fullName={profile.full_name || user.email || "User"}
      studioId={profile.studio_id}
      onboardingCompleted={profile.onboarding_completed ?? true}
      onboardingStep={profile.onboarding_step ?? 0}
      onboardingStartedAt={profile.onboarding_started_at ?? null}
    >
      {children}
    </MemberShell>
  );
}
