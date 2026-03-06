import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import EmptyState from "@/components/ui/empty-state";
import InstructorsListClient from "@/components/instructors/instructors-list-client";
import FlowHintPanel from "@/components/ui/flow-hint-panel";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Instructors - Klasly",
};

export default async function InstructorsPage() {
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

  const { data: instructors } = await supabase
    .from("instructors")
    .select("*, profiles(full_name, email, phone)")
    .eq("studio_id", profile.studio_id)
    .order("created_at", { ascending: false });

  const instructorIds = (instructors || []).map((i) => i.id);
  const { data: classesData } =
    instructorIds.length > 0
      ? await supabase
          .from("classes")
          .select("instructor_id")
          .in("instructor_id", instructorIds)
      : { data: [] };

  const classCountByInstructor: Record<string, number> = {};
  (instructors || []).forEach((i) => {
    classCountByInstructor[i.id] = 0;
  });
  (classesData || []).forEach((c) => {
    if (c.instructor_id) {
      classCountByInstructor[c.instructor_id] =
        (classCountByInstructor[c.instructor_id] || 0) + 1;
    }
  });

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Instructors</h1>
            <p className="mt-1 text-sm text-gray-500">
              {(instructors || []).length} instructor
              {(instructors || []).length !== 1 ? "s" : ""}
            </p>
          </div>
          <FlowHintPanel flowType="instructors" />
        </div>
        <Link href="/instructors/new" className="btn-primary">
          + Add instructor
        </Link>
      </div>

      <div className="mt-6">
        {(instructors || []).length === 0 ? (
          <EmptyState
            title="No instructors yet"
            actionLabel="+ Add your first instructor"
            actionHref="/instructors/new"
          />
        ) : (
          <InstructorsListClient
            instructors={instructors || []}
            classCountByInstructor={classCountByInstructor}
          />
        )}
      </div>
    </div>
  );
}
