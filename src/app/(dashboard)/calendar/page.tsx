import { Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardCalendar from "@/components/dashboard/calendar/dashboard-calendar";
import ScheduleActions from "@/components/dashboard/calendar/schedule-actions";
import CalendarLegend from "@/components/dashboard/calendar/calendar-legend";
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
      {canManageClasses ? (
        <Suspense fallback={null}>
          <ScheduleActions />
        </Suspense>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-500">
                View all sessions and room bookings
              </p>
              <ContextHelpLink href="/help/classes-scheduling/edit-cancel-session" />
            </div>
          </div>
          <div className="mt-4">
            <CalendarLegend />
          </div>
          <div className="mt-4">
            <DashboardCalendar />
          </div>
        </>
      )}
    </div>
  );
}
