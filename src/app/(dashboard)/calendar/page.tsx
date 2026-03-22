import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import DashboardCalendar from "@/components/dashboard/calendar/dashboard-calendar";
import ExportCsvButton from "@/components/ui/export-csv-button";
import { checkManagerPermission } from "@/lib/auth/check-manager-permission";
import ContextHelpLink from "@/components/help/context-help-link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Schedule - Klasly",
};

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
    .select("studio_id")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id) {
    redirect("/onboarding");
  }

  const permCheck = await checkManagerPermission("can_manage_classes");
  const canManageClasses = permCheck.allowed;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
            <ContextHelpLink href="/help/classes-scheduling/edit-cancel-session" />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            View all sessions and room bookings
          </p>
        </div>
        {canManageClasses && (
          <div className="flex gap-2">
            <ExportCsvButton
              url="/api/export/classes"
              filename={`classes-${new Date().toISOString().slice(0, 10)}.csv`}
              label="Export CSV"
            />
            <Link href="/calendar/import" className="btn-secondary">
              Import CSV
            </Link>
            <Link href="/classes" className="btn-secondary">
              Classes
            </Link>
            <Link href="/calendar/new" className="btn-primary">
              + Add class
            </Link>
          </div>
        )}
      </div>

      <div className="mt-6">
        <DashboardCalendar />
      </div>
    </div>
  );
}
