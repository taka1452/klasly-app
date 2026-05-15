import { fetchActivityEvents } from "@/lib/activity/fetch-events";
import {
  resolveDisplayPrefs,
  resolveThresholds,
} from "@/lib/activity/defaults";
import type {
  ActivityRole,
  ManagerPerms,
} from "@/lib/activity/types";
import { ActivityFeedWidget } from "./activity-feed-widget";

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

  return (
    <ActivityFeedWidget
      events={events}
      role={profile.role}
      thresholds={thresholds}
      displayPrefs={displayPrefs}
      canEditThresholds={canEditThresholds}
      variant={variant}
      limit={limit ?? (variant === "widget" ? 6 : undefined)}
      showSeeAll={showSeeAll ?? variant === "widget"}
      emptyMessage={
        variant === "fullpage"
          ? "No activity in the last 30 days yet."
          : "No recent activity yet."
      }
    />
  );
}
