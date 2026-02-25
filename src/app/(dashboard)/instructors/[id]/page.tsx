import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate, getDayName, formatTime } from "@/lib/utils";
import InstructorEditForm from "@/components/instructors/instructor-edit-form";
import InstructorDeleteButton from "@/components/instructors/instructor-delete-button";

export default async function InstructorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
      )
    : serverSupabase;

  const { data: instructor } = await supabase
    .from("instructors")
    .select("*, profiles(full_name, email, phone)")
    .eq("id", id)
    .single();

  if (!instructor) {
    notFound();
  }

  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("studio_id")
    .eq("id", user.id)
    .single();

  if (ownerProfile?.studio_id !== instructor.studio_id) {
    notFound();
  }

  const { data: assignedClasses } = await supabase
    .from("classes")
    .select("id, name, day_of_week, start_time")
    .eq("instructor_id", id)
    .eq("is_active", true)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  const profileData = instructor.profiles as {
    full_name?: string;
    email?: string;
    phone?: string;
  } | null;
  const rawProfile = Array.isArray(profileData) ? profileData[0] : profileData;
  const specialties = instructor.specialties as string[] | null;

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/instructors"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to instructors
        </Link>
        <div className="mt-2">
          <h1 className="text-2xl font-bold text-gray-900">
            {rawProfile?.full_name || "Unknown"}
          </h1>
          {specialties && specialties.length > 0 && (
            <p className="mt-1 text-sm text-gray-500">
              {specialties.join(", ")}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <InstructorEditForm
            instructorId={instructor.id}
            profileId={instructor.profile_id}
            initialData={{
              fullName: rawProfile?.full_name || "",
              phone: rawProfile?.phone || "",
              bio: instructor.bio || "",
              specialties: (specialties || []).join(", "),
            }}
          />
        </div>

        <div className="space-y-6">
          <div className="card">
            <h3 className="text-sm font-medium text-gray-500">
              Instructor Info
            </h3>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-xs text-gray-400">Email</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {rawProfile?.email || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Phone</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {rawProfile?.phone || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Joined</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {formatDate(instructor.created_at)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="card">
            <h3 className="text-sm font-medium text-gray-500">
              Assigned Classes
            </h3>
            {assignedClasses && assignedClasses.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {assignedClasses.map((cls) => (
                  <li
                    key={cls.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <Link
                      href={`/classes/${cls.id}`}
                      className="font-medium text-brand-600 hover:text-brand-700"
                    >
                      {cls.name}
                    </Link>
                    <span className="text-gray-500">
                      {getDayName(cls.day_of_week)} · {formatTime(cls.start_time)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-gray-500">No classes assigned</p>
            )}
          </div>

          <div className="card">
            <h3 className="text-sm font-medium text-red-600">Danger Zone</h3>
            <p className="mt-2 text-xs text-gray-500">
              Permanently remove this instructor. Assigned classes will be
              unassigned.
            </p>
            <InstructorDeleteButton instructorId={instructor.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
