import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rooms - Klasly",
};

export default async function RoomsPage() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) return null;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
    : serverSupabase;

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id) return null;

  const { data: rooms } = await supabase
    .from("rooms")
    .select("*")
    .eq("studio_id", profile.studio_id)
    .order("created_at", { ascending: true });

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rooms</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage studio spaces and rooms
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/rooms/bookings" className="btn-secondary">
            View Bookings
          </Link>
          <Link href="/rooms/new" className="btn-primary">
            + Add room
          </Link>
        </div>
      </div>

      <div className="mt-6">
        {rooms && rooms.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <div key={room.id} className="card flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{room.name}</h3>
                    {room.description && (
                      <p className="mt-1 text-sm text-gray-500">
                        {room.description}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      room.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {room.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                {room.capacity && (
                  <p className="text-sm text-gray-600">
                    Capacity: <span className="font-medium">{room.capacity}</span>
                  </p>
                )}

                <Link
                  href={`/rooms/${room.id}`}
                  className="mt-auto text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  Edit →
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center py-12">
            <p className="text-gray-500">No rooms yet.</p>
            <p className="mt-1 text-sm text-gray-400">
              Add rooms like &quot;Main Studio&quot; or &quot;Practitioner Room&quot; to assign them to classes.
            </p>
            <Link href="/rooms/new" className="btn-primary mt-4 inline-block">
              + Add your first room
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
