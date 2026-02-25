import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import WeeklySchedule from "@/components/classes/weekly-schedule";
import EmptyState from "@/components/ui/empty-state";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Classes - Klasly",
};

export default async function ClassesPage() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return null;
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
    return null;
  }

  const { data: classes } = await supabase
    .from("classes")
    .select("*, instructors(profiles(full_name))")
    .eq("studio_id", profile.studio_id)
    .eq("is_active", true)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Weekly schedule
          </p>
        </div>
        <Link href="/classes/new" className="btn-primary">
          + Add class
        </Link>
      </div>

      <div className="mt-6">
        {classes && classes.length > 0 ? (
          <WeeklySchedule classes={classes} />
        ) : (
          <EmptyState
            title="No classes yet"
            actionLabel="+ Create your first class"
            actionHref="/classes/new"
          />
        )}
      </div>
    </div>
  );
}
