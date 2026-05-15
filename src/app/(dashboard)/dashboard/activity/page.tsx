import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ActivityFeedSection } from "@/components/dashboard/activity/activity-feed-section";
import type {
  ActivityRole,
  ManagerPerms,
} from "@/lib/activity/types";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Activity — Klasly",
};

export default async function ActivityPage() {
  const server = await createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();
  if (!user) redirect("/login");

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
    : server;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, studio_id, role, activity_feed_prefs")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id) redirect("/onboarding");

  const { data: studio } = await supabase
    .from("studios")
    .select("id, activity_feed_settings")
    .eq("id", profile.studio_id)
    .single();

  let managerPerms: ManagerPerms | null = null;
  if (profile.role === "manager") {
    const { data: mgr } = await supabase
      .from("managers")
      .select(
        "can_manage_members, can_manage_classes, can_manage_bookings, can_manage_rooms, can_view_payments, can_send_messages, can_manage_settings",
      )
      .eq("profile_id", user.id)
      .eq("studio_id", profile.studio_id)
      .single();
    managerPerms = mgr as ManagerPerms | null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Activity</h1>
        <p className="mt-1 text-sm text-gray-500">
          Everything happening in your studio — signups, payments, schedule
          changes, and alerts.
        </p>
      </div>
      <ActivityFeedSection
        supabase={supabase}
        studio={
          studio ?? {
            id: profile.studio_id,
            activity_feed_settings: {},
          }
        }
        profile={{
          id: profile.id,
          role: profile.role as ActivityRole,
          activity_feed_prefs: profile.activity_feed_prefs ?? {},
        }}
        managerPerms={managerPerms}
        variant="fullpage"
      />
    </div>
  );
}
