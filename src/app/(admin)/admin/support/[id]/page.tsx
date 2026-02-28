import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdminTicketDetail from "@/components/admin/admin-ticket-detail";

export default async function AdminSupportTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { id } = await params;

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", id)
    .single();

  if (ticketError || !ticket) {
    notFound();
  }

  const { data: comments } = await supabase
    .from("support_ticket_comments")
    .select("id, content, created_by, created_at")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  let studio_name: string | null = null;
  if (ticket.studio_id) {
    const { data: studio } = await supabase.from("studios").select("name").eq("id", ticket.studio_id).single();
    studio_name = studio?.name ?? null;
  }

  return (
    <div className="space-y-6">
      <AdminTicketDetail
        ticket={{ ...ticket, studio_name }}
        comments={comments ?? []}
      />
    </div>
  );
}
