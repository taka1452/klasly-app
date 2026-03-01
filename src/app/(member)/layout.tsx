import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import MemberHeader from "@/components/member/member-header";
import WaiverGate from "@/components/waiver/waiver-gate";

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
    .select("full_name, role, studio_id")
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

  return (
    <div className="min-h-screen bg-gray-50">
      <MemberHeader
        userName={profile?.full_name || user.email || "User"}
        userEmail={user.email || ""}
      />
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl gap-6 px-4 py-3">
          <Link
            href="/schedule"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Schedule
          </Link>
          <Link
            href="/my-bookings"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            My Bookings
          </Link>
          <Link
            href="/purchase"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Purchase
          </Link>
          <Link
            href="/my-payments"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Payments
          </Link>
        </div>
      </nav>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
