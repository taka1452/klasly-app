import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function OnboardingSuccessPage() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) redirect("/login");

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

  if (!profile?.studio_id) redirect("/onboarding");

  const { data: studio } = await supabase
    .from("studios")
    .select("trial_ends_at")
    .eq("id", profile.studio_id)
    .single();

  const trialEndStr = studio?.trial_ends_at
    ? new Date(studio.trial_ends_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(
        "en-US",
        { month: "long", day: "numeric", year: "numeric" }
      );

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome to Klasly! Your 30-day trial has started.
        </h1>
        <p className="mt-4 text-gray-600">
          Your trial ends on <strong>{trialEndStr}</strong>. You won&apos;t be
          charged until then.
        </p>
        <Link href="/dashboard" className="btn-primary mt-8 inline-block">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
