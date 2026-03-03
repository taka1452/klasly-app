import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import WaiverGate from "@/components/waiver/waiver-gate";
import MemberLayoutClient from "@/components/member/member-layout-client";

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

  const needsWaiverCheck =
    profile?.studio_id != null && profile.studio_id !== "";
  let member: { id: string; waiver_signed: boolean } | null = null;
  let waiverTemplate: { id: string; title: string; content: string } | null = null;

  if (needsWaiverCheck && profile.studio_id) {
    const [memberRes, templateRes] = await Promise.all([
      supabase
        .from("members")
        .select("id, waiver_signed")
        .eq("profile_id", user.id)
        .eq("studio_id", profile.studio_id)
        .maybeSingle(),
      supabase
        .from("waiver_templates")
        .select("id, title, content")
        .eq("studio_id", profile.studio_id)
        .maybeSingle(),
    ]);
    member = memberRes.data ?? null;
    waiverTemplate = templateRes.data ?? null;
  }

  const needsWaiver =
    !!waiverTemplate && !!member && !member.waiver_signed;

  if (needsWaiver) {
    return <WaiverGate needsWaiver>{children}</WaiverGate>;
  }

  const onboardingCompleted =
    (profile as { onboarding_completed?: boolean })?.onboarding_completed ?? true;
  const onboardingStep =
    (profile as { onboarding_step?: number })?.onboarding_step ?? 0;
  const onboardingStartedAt =
    (profile as { onboarding_started_at?: string | null })?.onboarding_started_at ?? null;

  return (
    <MemberLayoutClient
      userName={profile?.full_name || user.email || "User"}
      userEmail={user.email || ""}
      onboardingCompleted={onboardingCompleted}
      onboardingStep={onboardingStep}
      onboardingStartedAt={onboardingStartedAt}
      userId={user.id}
    >
      {children}
    </MemberLayoutClient>
  );
}
