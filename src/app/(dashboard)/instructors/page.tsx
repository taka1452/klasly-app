import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import EmptyState from "@/components/ui/empty-state";
import InstructorsListClient from "@/components/instructors/instructors-list-client";
import FlowHintPanel from "@/components/ui/flow-hint-panel";
import ExportCsvButton from "@/components/ui/export-csv-button";
import { checkManagerPermission } from "@/lib/auth/check-manager-permission";
import { redirect } from "next/navigation";
import ContextHelpLink from "@/components/help/context-help-link";
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
    redirect("/login");
  }

  // マネージャー権限チェック（can_manage_instructors）
  const permCheck = await checkManagerPermission("can_manage_instructors");
  if (!permCheck.allowed) {
    redirect("/dashboard");
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
    redirect("/onboarding");
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
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">Instructors</h1>
              <ContextHelpLink href="/help/collective-mode/invite-instructor" />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {(instructors || []).length} instructor
              {(instructors || []).length !== 1 ? "s" : ""}
            </p>
          </div>
          <FlowHintPanel flowType="instructors" />
        </div>
        <div className="flex gap-2">
          <ExportCsvButton
            url="/api/export/instructors"
            filename={`instructors-${new Date().toISOString().slice(0, 10)}.csv`}
            label="Export CSV"
          />
          <Link href="/instructors/earnings" className="btn-secondary">
            Earnings Report
          </Link>
          <Link href="/instructors/tax-report" className="btn-secondary">
            Tax Report
          </Link>
          <Link href="/instructors/import" className="btn-secondary">
            Import CSV
          </Link>
          <Link href="/instructors/new" className="btn-primary">
            + Add instructor
          </Link>
        </div>
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
