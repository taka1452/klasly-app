import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import Link from "next/link";
import AdminSupportList from "@/components/admin/admin-support-list";

const LIMIT = 20;

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string; search?: string; page?: string }>;
}) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { status = "", priority = "", search = "", page = "1" } = await searchParams;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const offset = (pageNum - 1) * LIMIT;

  let query = supabase
    .from("support_tickets")
    .select("id, ticket_number, studio_id, subject, description, status, priority, created_by, created_at, updated_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + LIMIT - 1);

  if (status) query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);
  if (search) query = query.or(`subject.ilike.%${search}%,description.ilike.%${search}%`);

  const { data: tickets, count: totalCount } = await query;

  const studioIds = Array.from(new Set((tickets || []).map((t) => t.studio_id).filter(Boolean))) as string[];
  const { data: studios } =
    studioIds.length > 0 ? await supabase.from("studios").select("id, name").in("id", studioIds) : { data: [] };
  const studioNames = (studios || []).reduce((acc, s) => ({ ...acc, [s.id]: s.name }), {} as Record<string, string>);

  const list = (tickets || []).map((t) => ({
    ...t,
    studio_name: t.studio_id ? studioNames[t.studio_id] ?? null : null,
  }));

  return (
    <div className="space-y-6">
      <AdminSupportList
        tickets={list}
        total={totalCount ?? 0}
        page={pageNum}
        limit={LIMIT}
        currentStatus={status}
        currentPriority={priority}
        currentSearch={search}
      />
    </div>
  );
}
