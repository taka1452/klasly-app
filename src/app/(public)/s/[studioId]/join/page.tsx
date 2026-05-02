import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/admin/supabase";
import StudioJoinForm from "./StudioJoinForm";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ studioId: string }>;
};

export default async function StudioJoinPage({ params }: Props) {
  const { studioId } = await params;
  const admin = createAdminClient();

  const { data: studio } = await admin
    .from("studios")
    .select("id, name, plan_status, is_demo, max_members")
    .eq("id", studioId)
    .maybeSingle();

  if (!studio) notFound();

  const acceptedStatuses = new Set(["active", "trial", "trialing", null]);
  let blockedReason: string | null = null;
  if (studio.is_demo) {
    blockedReason =
      "This studio is currently in demo mode and isn't accepting signups.";
  } else if (
    studio.plan_status !== null &&
    !acceptedStatuses.has(studio.plan_status as string)
  ) {
    blockedReason = "This studio isn't currently accepting new members.";
  } else if (studio.max_members && studio.max_members > 0) {
    const { count } = await admin
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studioId);
    if ((count ?? 0) >= studio.max_members) {
      blockedReason = "This studio has reached its member capacity.";
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
          Join studio
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">{studio.name}</h1>
        <p className="mt-2 text-sm text-gray-600">
          Create an account to book classes, track attendance and manage your
          membership.
        </p>

        {blockedReason ? (
          <div className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {blockedReason}
          </div>
        ) : (
          <div className="mt-6">
            <StudioJoinForm studioId={studio.id} studioName={studio.name} />
          </div>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-brand-600 hover:text-brand-700"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
