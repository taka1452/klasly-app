import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import SupportTicketDetailClient from "@/components/settings/support-ticket-detail-client";

export default async function SupportTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) redirect("/login");

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) notFound();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "owner" || !profile?.studio_id) notFound();

  const { id } = await params;

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", id)
    .eq("studio_id", profile.studio_id)
    .single();

  if (ticketError || !ticket) notFound();

  const { data: comments } = await supabase
    .from("support_ticket_comments")
    .select("id, content, created_by, created_at")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  return (
    <div>
      <Link href="/settings/support" className="text-sm text-gray-500 hover:text-gray-700">
        ← Back to Support
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-gray-900">
        Ticket #{ticket.ticket_number}
      </h1>

      <SupportTicketDetailClient
        ticket={ticket}
        comments={comments ?? []}
      />
    </div>
  );
}
