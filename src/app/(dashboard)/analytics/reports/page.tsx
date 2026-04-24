import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { checkManagerPermission } from "@/lib/auth/check-manager-permission";
import ReportBuilderClient from "@/components/analytics/report-builder-client";

export const metadata: Metadata = {
  title: "Reports — Klasly",
};

export default async function ReportsPage() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) redirect("/login");

  const perm = await checkManagerPermission();
  if (!perm.allowed) redirect("/dashboard");
  if (perm.role === "manager" && !perm.permissions?.can_view_payments) {
    redirect("/dashboard");
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
    .select("id, profiles(full_name)")
    .eq("studio_id", profile.studio_id);
  const instructorOptions = (instructors || []).map((i) => {
    const prof = Array.isArray(i.profiles) ? i.profiles[0] : i.profiles;
    return {
      id: i.id as string,
      name: (prof as { full_name?: string } | null)?.full_name || "Instructor",
    };
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="mt-1 text-sm text-gray-500">
          Build, save and re-run reports on revenue, attendance, instructor
          payouts, member growth, drop-ins, and room utilization.
        </p>
      </div>

      <ReportBuilderClient instructors={instructorOptions} />
    </div>
  );
}
