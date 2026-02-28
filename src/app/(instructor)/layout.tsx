import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import InstructorShell from "@/components/ui/instructor-shell";

export default async function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminSupabase = serviceRoleKey
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
      )
    : supabase;

  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("role, full_name, studio_id")
    .eq("id", user.id)
    .single();

  if (profile?.role === "owner") {
    redirect("/");
  }

  if (profile?.role === "member") {
    redirect("/schedule");
  }

  if (profile?.role !== "instructor") {
    redirect("/login");
  }

  if (!profile?.studio_id) {
    redirect("/login");
  }

  const { data: studio } = await adminSupabase
    .from("studios")
    .select("name")
    .eq("id", profile.studio_id)
    .single();

  const studioName = (studio as { name?: string })?.name || "Studio";
  const userName = profile.full_name || user.email || "Instructor";
  const userEmail = user.email || "";

  return (
    <InstructorShell
      studioName={studioName}
      userName={userName}
      userEmail={userEmail}
    >
      {children}
    </InstructorShell>
  );
}
