"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  ActivityCategory,
  ActivityEvent,
  ActivityRole,
  AlertThresholds,
  DisplayPrefs,
} from "@/lib/activity/types";
import { ActivityFeedItem } from "./activity-feed-item";
import { ActivitySettingsPopover } from "./activity-settings-popover";

type TabKey = "all" | ActivityCategory;

const ALL_TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "booking", label: "Bookings" },
  { key: "billing", label: "Billing" },
  { key: "operations", label: "Operations" },
  { key: "member", label: "Members" },
  { key: "announcement", label: "Announcements" },
  { key: "alert", label: "Alerts" },
];

const TABS_BY_ROLE: Record<ActivityRole, TabKey[]> = {
  owner: ["all", "booking", "billing", "operations", "member", "alert"],
  manager: ["all", "booking", "billing", "operations", "member", "alert"],
  instructor: ["all", "booking", "operations", "member", "alert"],
  member: ["all", "booking", "billing", "announcement", "alert"],
};

interface Props {
  events: ActivityEvent[];
  role: ActivityRole;
  thresholds: AlertThresholds;
  displayPrefs: DisplayPrefs;
  canEditThresholds: boolean;
  limit?: number;
  showHeader?: boolean;
  showSeeAll?: boolean;
  variant?: "widget" | "fullpage";
  emptyMessage?: string;
}

export function ActivityFeedWidget({
  events,
  role,
  thresholds,
  displayPrefs,
  canEditThresholds,
  limit,
  showHeader = true,
  showSeeAll = true,
  variant = "widget",
  emptyMessage = "No activity yet",
}: Props) {
  const tabsForRole = ALL_TABS.filter((t) =>
    TABS_BY_ROLE[role].includes(t.key),
  );

  const defaultTab = (displayPrefs.default_tab as TabKey) || "all";
  const initialTab = tabsForRole.some((t) => t.key === defaultTab)
    ? defaultTab
    : "all";
  const [tab, setTab] = useState<TabKey>(initialTab);

  const alertCount = useMemo(
    () =>
      events.filter(
        (e) =>
          e.category === "alert" &&
          (e.severity === "critical" || e.severity === "warning"),
      ).length,
    [events],
  );

  const filtered = useMemo(() => {
    let arr = events;
    if (tab !== "all") arr = arr.filter((e) => e.category === tab);
    if (displayPrefs.hide_read) arr = arr.filter((e) => e.unread !== false);
    return arr;
  }, [events, tab, displayPrefs.hide_read]);

  const list = typeof limit === "number" ? filtered.slice(0, limit) : filtered;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {showHeader && (
        <div className="flex items-center justify-between px-4 pt-4 md:px-6 md:pt-5">
          <h2 className="text-base font-semibold text-gray-900">Activity</h2>
          <ActivitySettingsPopover
            initialThresholds={thresholds}
            initialDisplayPrefs={displayPrefs}
            canEditThresholds={canEditThresholds}
          />
        </div>
      )}
      <div className="px-4 pb-2 pt-3 md:px-6">
        <div className="scrollbar-hide flex gap-1 overflow-x-auto">
          {tabsForRole.map((t) => {
            const active = tab === t.key;
            const isAlert = t.key === "alert";
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {t.label}
                {isAlert && alertCount > 0 && (
                  <span
                    className={`inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold leading-4 ${
                      active ? "bg-white text-gray-900" : "bg-red-600 text-white"
                    }`}
                  >
                    {alertCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {variant === "fullpage" && (
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-4 py-3 md:px-6">
          <span className="text-xs text-gray-500">
            Last 30 days
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {filtered.length} event{filtered.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      )}
      {list.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {list.map((e) => (
            <li key={e.id}>
              <ActivityFeedItem event={e} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-4 py-12 text-center text-sm text-gray-500 md:px-6">
          {emptyMessage}
        </div>
      )}
      {showSeeAll && (
        <div className="border-t border-gray-100 px-4 py-3 text-center md:px-6">
          <Link
            href="/dashboard/activity"
            className="text-xs font-medium text-brand-700 hover:text-brand-800"
          >
            See all →
          </Link>
        </div>
      )}
    </div>
  );
}
