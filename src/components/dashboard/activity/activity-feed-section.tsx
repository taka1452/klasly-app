import { fetchActivityEvents } from "@/lib/activity/fetch-events";
import {
  resolveDisplayPrefs,
  resolveThresholds,
} from "@/lib/activity/defaults";
import type {
  ActivityRole,
  ManagerPerms,
} from "@/lib/activity/types";
import { CollapsibleSection } from "@/components/dashboard/collapsible-section";
import { ActivityFeedRealtime } from "./activity-feed-realtime";
import { ActivityFeedWidget } from "./activity-feed-widget";
import { ActivitySettingsPopover } from "./activity-settings-popover";

import type { SupabaseClient } from "@supabase/supabase-js";

interface Props {
  supabase: SupabaseClient;
  studio: {
    id: string;
    activity_feed_settings?: Record<string, unknown> | null;
  };
  profile: {
    id: string;
    role: ActivityRole;
    activity_feed_prefs?: Record<string, unknown> | null;
  };
  managerPerms?: ManagerPerms | null;
  variant?: "widget" | "fullpage";
  limit?: number;
  showSeeAll?: boolean;
}

export async function ActivityFeedSection({
  supabase,
  studio,
  profile,
  managerPerms,
  variant = "widget",
  limit,
  showSeeAll,
}: Props) {
  const thresholds = resolveThresholds(
    (studio.activity_feed_settings ?? {}) as never,
  );
  const displayPrefs = resolveDisplayPrefs(
    (profile.activity_feed_prefs ?? {}) as never,
  );

  const canEditThresholds =
    profile.role === "owner" ||
    (profile.role === "manager" && managerPerms?.can_manage_settings === true);

  const events = await fetchActivityEvents({
    supabase,
    studioId: studio.id,
    role: profile.role,
    viewerProfileId: profile.id,
    managerPerms,
    thresholds,
    lookbackDays: variant === "fullpage" ? 30 : 14,
    limit: variant === "fullpage" ? 200 : 30,
  });

  const widget = (
    <ActivityFeedWidget
      events={events}
      role={profile.role}
      thresholds={thresholds}
      displayPrefs={displayPrefs}
      canEditThresholds={canEditThresholds}
      variant={variant}
      limit={limit ?? (variant === "widget" ? 10 : undefined)}
      showSeeAll={showSeeAll ?? variant === "widget"}
      showHeader={false}
      emptyMessage={
        variant === "fullpage"
          ? "No activity in the last 30 days yet."
          : "No recent activity yet."
      }
    />
  );

  const settingsButton = (
    <ActivitySettingsPopover
      initialThresholds={thresholds}
      initialDisplayPrefs={displayPrefs}
      canEditThresholds={canEditThresholds}
    />
  );

  if (variant === "fullpage") {
    return (
      <div className="space-y-6">
        <ActivityFeedRealtime studioId={studio.id} />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              Activity
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Everything happening in your studio — signups, payments, schedule
              changes, and alerts.
            </p>
          </div>
          <div className="shrink-0">{settingsButton}</div>
        </div>
        {widget}
      </div>
    );
  }

  return (
    <CollapsibleSection
      id="activity-home"
      title="Activity"
      className=""
      actions={settingsButton}
    >
      <ActivityFeedRealtime studioId={studio.id} />
      {widget}
    </CollapsibleSection>
  );
}
