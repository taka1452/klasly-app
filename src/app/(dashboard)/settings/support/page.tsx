import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import SupportTicketsClient from "@/components/settings/support-tickets-client";

export default async function SupportPage() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) redirect("/login");

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
        Support is temporarily unavailable.
      </div>
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "owner" || !profile?.studio_id) {
    return (
      <div>
        <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Settings
        </Link>
        <p className="mt-4 text-gray-600">Support tickets are available for studio owners only.</p>
      </div>
    );
  }

  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("id, ticket_number, subject, status, priority, created_at")
    .eq("studio_id", profile.studio_id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-700">
        ← Back to Settings
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-gray-900">Support</h1>
      <p className="mt-1 text-sm text-gray-600">
        Open a ticket or view your existing tickets.
      </p>

      <SupportTicketsClient initialTickets={tickets ?? []} />
    </div>
  );
}
