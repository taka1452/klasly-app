import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import Link from "next/link";

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Instructors</h1>
          <p className="mt-1 text-sm text-gray-500">
            {(instructors || []).length} instructor
            {(instructors || []).length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/instructors/new" className="btn-primary">
          + Add instructor
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(instructors || []).length === 0 ? (
          <div className="card col-span-full">
            <p className="text-sm text-gray-500">No instructors yet. Add your first instructor!</p>
          </div>
        ) : (
          (instructors || []).map((instructor) => {
            const profileData = instructor.profiles as {
              full_name?: string;
              email?: string;
              phone?: string;
            } | null;
            const raw = Array.isArray(profileData) ? profileData[0] : profileData;
            const specialties = instructor.specialties as string[] | null;
            const classCount = classCountByInstructor[instructor.id] ?? 0;

            return (
              <div key={instructor.id} className="card">
                <h3 className="font-medium text-gray-900">
                  {raw?.full_name || "—"}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {raw?.email || "—"}
                </p>
                {specialties && specialties.length > 0 && (
                  <p className="mt-2 text-xs text-gray-600">
                    {specialties.join(", ")}
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-400">
                  {classCount} class{classCount !== 1 ? "es" : ""} assigned
                </p>
                <Link
                  href={`/instructors/${instructor.id}`}
                  className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  View
                </Link>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
