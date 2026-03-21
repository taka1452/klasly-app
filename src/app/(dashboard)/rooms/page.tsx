import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import RoomsPageClient from "@/components/dashboard/rooms-page-client";
import { checkManagerPermission } from "@/lib/auth/check-manager-permission";

export const metadata: Metadata = {
  title: "Rooms - Klasly",
};

export default async function RoomsPage() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // マネージャー権限チェック（can_manage_rooms）
  const permCheck = await checkManagerPermission("can_manage_rooms");
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

  // Check if owner is also an instructor
  const { data: instrRec } = await supabase
    .from("instructors")
    .select("id")
    .eq("profile_id", user.id)
    .eq("studio_id", profile.studio_id)
    .maybeSingle();

  const isAlsoInstructor = !!instrRec;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rooms</h1>
          <p className="mt-1 text-sm text-gray-500">
            Room usage &amp; bookings
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/rooms/manage" className="btn-secondary">
            Manage Rooms
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <RoomsPageClient isAlsoInstructor={isAlsoInstructor} />
      </div>
    </div>
  );
}
