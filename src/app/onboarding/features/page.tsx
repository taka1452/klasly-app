"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Video,
  FileCheck,
  ShieldCheck,
  EyeOff,
  ClipboardList,
  BarChart3,
  CalendarRange,
  Users,
  Calendar,
  UserCheck,
  CreditCard,
  MessageCircle,
} from "lucide-react";

/** Core features — always ON, shown as greyed-out */
const CORE_FEATURES = [
  { label: "Member Management", icon: UserCheck },
  { label: "Scheduling", icon: Calendar },
  { label: "Payments", icon: CreditCard },
  { label: "Messaging", icon: MessageCircle },
] as const;

/** Optional features the user can toggle */
const OPTIONAL_FEATURES = [
  {
    key: "extension.online_classes",
    label: "Online Classes",
    icon: Video,
    description: "Add Zoom/Meet links to classes",
  },
  {
    key: "core.waiver",
    label: "Digital Waivers",
    icon: FileCheck,
    description: "Require members to sign a liability waiver",
  },
  {
    key: "extension.minor_waiver",
    label: "Minor Waiver",
    icon: ShieldCheck,
    description: "Send waivers to guardians for under-18 members",
  },
  {
    key: "collective.schedule_visibility",
    label: "Schedule Visibility",
    icon: EyeOff,
    description: "Mark sessions as private (hidden from members)",
  },
  {
    key: "extension.soap_notes",
    label: "SOAP Notes",
    icon: ClipboardList,
    description: "Practitioner session records (S/O/A/P format)",
  },
  {
    key: "extension.utm_tracking",
    label: "UTM Tracking",
    icon: BarChart3,
    description: "Track where your members come from",
  },
  {
    key: "extension.retreat_booking",
    label: "Events & Retreats",
    icon: CalendarRange,
    description: "Multi-day events with room options and payments",
  },
  {
    key: "collective.instructor_direct_payout",
    label: "Collective Mode",
    icon: Users,
    description: "Instructors run independent businesses in your space",
  },
] as const;

export default function OnboardingFeaturesPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/onboarding/status");
        const data = await res.json().catch(() => ({}));

        if (cancelled) return;

        if (data.redirectToLogin) {
          router.push("/login");
          return;
        }

        if (!data.hasStudio) {
          router.push("/onboarding");
          return;
        }

        // Already has plan — skip to dashboard
        if (!data.needsPlan) {
          router.push("/dashboard");
          return;
        }
      } catch {
        if (!cancelled) router.push("/onboarding");
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function toggleFeature(key: string) {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleContinue() {
    setSaving(true);

    // Only send features that are enabled
    const enabledFeatures: Record<string, boolean> = {};
    for (const feat of OPTIONAL_FEATURES) {
      if (selected[feat.key]) {
        enabledFeatures[feat.key] = true;
      }
    }

    if (Object.keys(enabledFeatures).length > 0) {
      try {
        await fetch("/api/studio/features", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ features: enabledFeatures }),
        });
      } catch {
        // Continue even if save fails — user can set up later
      }
    }

    router.push("/onboarding/plan");
  }

  function handleSkip() {
    router.push("/onboarding/plan");
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="mt-4 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-brand-700">Klasly</h1>
          <h2 className="mt-4 text-2xl font-bold text-gray-900">
            Choose your features
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Select the features you need. You can change these anytime in
            Settings.
          </p>
        </div>

        {/* Core features — always on */}
        <div className="mt-8">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Core — Always included
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CORE_FEATURES.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.label}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 opacity-60"
                >
                  <Icon className="h-4 w-4 text-gray-400" />
                  <span className="text-xs font-medium text-gray-500">
                    {feat.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Optional features */}
        <div className="mt-8">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Optional — Enable what you need
          </h3>
          <div className="mt-3 space-y-2">
            {OPTIONAL_FEATURES.map((feat) => {
              const Icon = feat.icon;
              const isOn = !!selected[feat.key];
              return (
                <button
                  key={feat.key}
                  type="button"
                  onClick={() => toggleFeature(feat.key)}
                  className={`flex w-full items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition ${
                    isOn
                      ? "border-brand-500 bg-brand-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div
                    className={`rounded-lg p-2 ${
                      isOn ? "bg-brand-100" : "bg-gray-100"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 ${
                        isOn ? "text-brand-600" : "text-gray-500"
                      }`}
                    />
                  </div>
                  <div className="flex-1">
                    <p
                      className={`text-sm font-semibold ${
                        isOn ? "text-brand-900" : "text-gray-900"
                      }`}
                    >
                      {feat.label}
                    </p>
                    <p className="text-xs text-gray-500">{feat.description}</p>
                  </div>
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
                      isOn
                        ? "border-brand-600 bg-brand-600"
                        : "border-gray-300 bg-white"
                    }`}
                  >
                    {isOn && (
                      <svg
                        className="h-3 w-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Don&apos;t worry — you can change these anytime in Settings &rarr;
          Features.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={handleContinue}
            disabled={saving}
            className="btn-primary px-8"
          >
            {saving ? "Saving..." : "Continue →"}
          </button>
          <button
            type="button"
            onClick={handleSkip}
            className="text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Skip — I&apos;ll set this up later &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
