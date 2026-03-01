import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import MemberHeader from "@/components/member/member-header";
import InlineWaiverSign from "@/components/waiver/inline-waiver-sign";

export default async function WaiverPage() {
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
    .select("full_name, role, studio_id")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "member" || !profile.studio_id) {
    redirect("/schedule");
  }

  const [memberRes, templateRes, studioRes] = await Promise.all([
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
    supabase
      .from("studios")
      .select("name")
      .eq("id", profile.studio_id)
      .single(),
  ]);

  const member = memberRes.data ?? null;
  const waiverTemplate = templateRes.data ?? null;
  const studioName = (studioRes.data as { name?: string } | null)?.name ?? "";

  if (!member || !waiverTemplate || member.waiver_signed) {
    redirect("/schedule");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MemberHeader
        userName={profile?.full_name || user.email || "User"}
        userEmail={user.email || ""}
      />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <InlineWaiverSign
          memberId={member.id}
          waiverTitle={waiverTemplate.title}
          waiverContent={waiverTemplate.content}
          studioName={studioName}
          memberName={profile?.full_name || ""}
          redirectTo="/schedule"
        />
      </main>
    </div>
  );
}
