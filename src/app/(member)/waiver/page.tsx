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
      .select("id, waiver_signed, is_minor, date_of_birth, guardian_email")
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

  const member = memberRes.data as
    | {
        id: string;
        waiver_signed?: boolean;
        is_minor?: boolean;
        date_of_birth?: string | null;
        guardian_email?: string | null;
      }
    | null;
  const waiverTemplate = templateRes.data ?? null;
  const studioName = (studioRes.data as { name?: string } | null)?.name ?? "";

  // A previously-minor member who's now 18+ must re-sign as an adult.
  const agedOut = (() => {
    if (!member?.is_minor || !member.date_of_birth) return false;
    const birth = new Date(member.date_of_birth);
    return Date.now() - birth.getTime() >= 18 * 365.25 * 24 * 60 * 60 * 1000;
  })();

  if (!member || !waiverTemplate) {
    redirect("/schedule");
  }

  // Already signed and not aged out → no waiver to handle.
  if (member.waiver_signed && !agedOut) {
    redirect("/schedule");
  }

  // Minor who hasn't aged out: their guardian needs to sign. The minor
  // themselves cannot click "I agree" — show a clear message instead.
  if (member.is_minor && !agedOut) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MemberHeader
          userName={profile?.full_name || user.email || "User"}
          userEmail={user.email || ""}
        />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-semibold text-gray-900">
            Your guardian needs to sign
          </h1>
          <p className="mt-3 text-sm text-gray-600">
            {studioName} requires a parent or legal guardian to sign the
            waiver on your behalf before you can book.
          </p>
          {member.guardian_email ? (
            <p className="mt-4 text-sm text-gray-700">
              An invite has been sent to{" "}
              <strong className="text-gray-900">{member.guardian_email}</strong>.
              Ask them to check their inbox and complete the signing link.
            </p>
          ) : (
            <p className="mt-4 text-sm text-gray-700">
              We don&apos;t have a guardian email on file. Please contact{" "}
              {studioName} so they can send the signing link to your guardian.
            </p>
          )}
        </main>
      </div>
    );
  }

  // Adult flow (including aged-out former minors who must re-sign).
  return (
    <div className="min-h-screen bg-gray-50">
      <MemberHeader
        userName={profile?.full_name || user.email || "User"}
        userEmail={user.email || ""}
      />
      <main className="mx-auto max-w-2xl px-4 py-8">
        {agedOut && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            You&apos;ve turned 18 since your previous waiver was signed. Please
            re-sign as an adult to continue booking.
          </div>
        )}
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
