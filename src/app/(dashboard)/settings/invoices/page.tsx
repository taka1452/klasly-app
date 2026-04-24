import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { checkManagerPermission } from "@/lib/auth/check-manager-permission";
import InstructorInvoicesClient from "@/components/settings/instructor-invoices-client";

export const metadata: Metadata = {
  title: "Instructor invoices — Klasly",
};

export default async function InstructorInvoicesPage() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) redirect("/login");

  // Gate: owner, or manager with either can_manage_contracts_tiers or
  // can_view_payments (invoices touch both surfaces).
  const perm = await checkManagerPermission();
  if (!perm.allowed) redirect("/dashboard");
  if (perm.role === "manager") {
    const ok =
      perm.permissions?.can_manage_contracts_tiers ||
      perm.permissions?.can_view_payments;
    if (!ok) redirect("/settings");
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
    : serverSupabase;

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id")
    .eq("id", user.id)
    .single();
  if (!profile?.studio_id) redirect("/onboarding");

  const { data: instructors } = await supabase
    .from("instructors")
    .select("id, profiles(full_name, email)")
    .eq("studio_id", profile.studio_id)
    .order("created_at");

  const instructorList = (instructors || []).map((i) => {
    const prof = Array.isArray(i.profiles) ? i.profiles[0] : i.profiles;
    return {
      id: i.id as string,
      fullName: (prof as { full_name?: string } | null)?.full_name || "Instructor",
      email: (prof as { email?: string } | null)?.email || "",
    };
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Instructor invoices</h1>
        <p className="mt-1 text-sm text-gray-500">
          Bundle each instructor&apos;s monthly obligations (tier subscription,
          overage, flat &amp; per-class fees) into one invoice you can send and
          track.
        </p>
      </div>

      <InstructorInvoicesClient instructors={instructorList} />
    </div>
  );
}
