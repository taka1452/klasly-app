"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Video,
  FileCheck,
  ShieldCheck,
  EyeOff,
  ClipboardList,
  BarChart3,
  CalendarRange,
  Users,
} from "lucide-react";

/**
 * Feature items the owner can toggle.
 * Maps feature_key → display info.
 */
const OPTIONAL_FEATURES = [
  {
    key: "extension.online_classes",
    label: "Online Classes",
    icon: Video,
    description: "Add Zoom/Meet links to classes",
    helpHref: "/help#online-classes",
  },
  {
    key: "core.waiver",
    label: "Digital Waivers",
    icon: FileCheck,
    description: "Require members to sign a liability waiver",
    helpHref: "/help#waivers",
  },
  {
    key: "extension.minor_waiver",
    label: "Minor Waiver",
    icon: ShieldCheck,
    description: "Send waivers to guardians for under-18 members",
    helpHref: "/help#waivers",
  },
  {
    key: "collective.schedule_visibility",
    label: "Schedule Visibility",
    icon: EyeOff,
    description: "Mark sessions as private (hidden from members)",
    helpHref: "/help#schedule-visibility",
  },
  {
    key: "extension.soap_notes",
    label: "SOAP Notes",
    icon: ClipboardList,
    description: "Practitioner session records (S/O/A/P format)",
    helpHref: "/help#soap-notes",
  },
  {
    key: "extension.utm_tracking",
    label: "UTM Tracking",
    icon: BarChart3,
    description: "Track where your members come from",
    helpHref: "/help#utm-tracking",
  },
  {
    key: "extension.retreat_booking",
    label: "Events & Retreats",
    icon: CalendarRange,
    description: "Multi-day events with room options and payments",
    helpHref: "/help#events-retreats",
  },
  {
    key: "collective.instructor_direct_payout",
    label: "Collective Mode",
    icon: Users,
    description: "Instructors run independent businesses in your space",
    helpHref: "/help#collective-mode",
  },
] as const;

export default function FeaturesSettingsPage() {
  const router = useRouter();
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/studio/features")
      .then((r) => r.json())
      .then((data) => {
        setFeatures(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleToggle(key: string, enabled: boolean) {
    setToggling(key);
    const prev = features[key];
    setFeatures((f) => ({ ...f, [key]: enabled }));

    try {
      const res = await fetch("/api/studio/features", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature_key: key, enabled }),
      });

      if (!res.ok) {
        // Revert on error
        setFeatures((f) => ({ ...f, [key]: prev ?? false }));
      } else {
        // Refresh context so sidebar/UI updates
        router.refresh();
      }
    } catch {
      setFeatures((f) => ({ ...f, [key]: prev ?? false }));
    } finally {
      setToggling(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/settings"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back to settings
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Features</h1>
        <p className="mt-1 text-sm text-gray-500">
          Enable or disable optional features for your studio.
        </p>
      </div>

      <div className="space-y-3">
        {OPTIONAL_FEATURES.map((feat) => {
          const Icon = feat.icon;
          const enabled = features[feat.key] ?? false;
          const isToggling = toggling === feat.key;

          return (
            <div
              key={feat.key}
              className="card flex items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-gray-100 p-2">
                  <Icon className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {feat.label}
                  </h3>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {feat.description}
                  </p>
                  <Link
                    href={feat.helpHref}
                    className="mt-1 inline-block text-xs text-brand-600 hover:text-brand-700"
                  >
                    Learn more &rarr;
                  </Link>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                disabled={isToggling}
                onClick={() => handleToggle(feat.key, !enabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 ${
                  enabled ? "bg-brand-600" : "bg-gray-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
