import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import RoomEditForm from "@/components/rooms/room-edit-form";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) notFound();

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
    : serverSupabase;

  const { data: room } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", id)
    .single();

  if (!room) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id || profile.studio_id !== room.studio_id) notFound();

  const roomMgmtEnabled = await isFeatureEnabled(profile.studio_id, FEATURE_KEYS.ROOM_MANAGEMENT);
  if (!roomMgmtEnabled) redirect("/dashboard");

  return (
    <div>
      <div className="mb-6">
        <Link href="/rooms" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to rooms
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{room.name}</h1>
      </div>

      <div className="max-w-xl">
        <RoomEditForm
          roomId={room.id}
          initialData={{
            name: room.name,
            description: room.description || "",
            capacity: room.capacity ?? "",
            isActive: room.is_active,
          }}
        />
      </div>
    </div>
  );
}
