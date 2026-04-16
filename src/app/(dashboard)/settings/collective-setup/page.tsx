import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CheckCircle2,
  DoorOpen,
  Layers,
  Percent,
  UserPlus,
  ArrowRight,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Collective Mode Setup - Klasly",
};

type Step = {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  done: boolean;
};

export default async function CollectiveSetupPage() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) redirect("/login");

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
    : serverSupabase;

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, studios(*)")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id) redirect("/onboarding");

  const studioId = profile.studio_id;

  // Check each step's completion status
  const [
    { count: roomsCount },
    { count: tiersCount },
    { count: instructorsCount },
  ] = await Promise.all([
    supabase.from("rooms").select("id", { count: "exact", head: true }).eq("studio_id", studioId),
    supabase.from("instructor_membership_tiers").select("id", { count: "exact", head: true }).eq("studio_id", studioId),
    supabase.from("instructors").select("id", { count: "exact", head: true }).eq("studio_id", studioId),
  ]);

  // Check studio fee setting
  const studioData = profile.studios as { studio_fee_percentage?: number | null } | null;
  const hasFeeSet = (studioData?.studio_fee_percentage ?? null) !== null && (studioData?.studio_fee_percentage ?? 0) > 0;

  const steps: Step[] = [
    {
      id: "rooms",
      icon: <DoorOpen className="h-5 w-5" />,
      title: "1. Set up your rooms",
      description: "Define the physical spaces in your studio (e.g., Main Studio, Practitioner Room). Instructors will choose a room when creating their classes.",
      href: "/settings/rooms",
      done: (roomsCount ?? 0) >= 1,
    },
    {
      id: "tiers",
      icon: <Layers className="h-5 w-5" />,
      title: "2. Define instructor contracts",
      description: "Create hourly plans with different hour allowances and prices (e.g., Community: 3h/$60, Growth: 16h/$280), or set up flat / per-class fees per instructor.",
      href: "/settings/contracts?tab=hourly",
      done: (tiersCount ?? 0) >= 1,
    },
    {
      id: "fee",
      icon: <Percent className="h-5 w-5" />,
      title: "3. Set your Studio Fee",
      description: "Choose the percentage automatically deducted from each instructor's transactions. This is your cut on top of the monthly tier fee.",
      href: "/settings/payout",
      done: hasFeeSet,
    },
    {
      id: "instructors",
      icon: <UserPlus className="h-5 w-5" />,
      title: "4. Invite your first instructor",
      description: "Send an email invitation. They'll join with one click, then connect their own Stripe account and choose a membership tier.",
      href: "/instructors/new",
      done: (instructorsCount ?? 0) >= 1,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/settings"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back to settings
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          Collective Mode Setup
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Follow these steps to get your shared studio up and running.
          {doneCount > 0 && !allDone && ` (${doneCount}/${steps.length} done)`}
        </p>
      </div>

      {allDone && (
        <div className="mb-6 rounded-lg bg-emerald-50 border border-emerald-200 p-4">
          <p className="text-sm font-medium text-emerald-800">
            Your Collective Mode is fully configured! Instructors can now book rooms and manage their own classes.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`card flex items-start gap-4 ${
              step.done ? "opacity-60" : ""
            }`}
          >
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                step.done
                  ? "bg-emerald-100 text-emerald-600"
                  : "bg-brand-50 text-brand-600"
              }`}
            >
              {step.done ? <CheckCircle2 className="h-5 w-5" /> : step.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3
                className={`text-sm font-semibold ${
                  step.done ? "text-gray-500 line-through" : "text-gray-900"
                }`}
              >
                {step.title}
              </h3>
              <p className="mt-1 text-sm text-gray-500 leading-relaxed">
                {step.description}
              </p>
              {!step.done && (
                <Link
                  href={step.href}
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  Get started
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Help link */}
      <div className="mt-8 text-center">
        <Link
          href="/help/collective-mode/collective-overview"
          className="text-sm text-gray-500 hover:text-brand-600"
        >
          Need help? Read the Collective Mode guide &rarr;
        </Link>
      </div>
    </div>
  );
}
