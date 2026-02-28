import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";

const LIMIT = 20;

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const supabase = createAdminClient();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status")?.trim() || "";
    const priority = searchParams.get("priority")?.trim() || "";
    const search = searchParams.get("search")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || String(LIMIT), 10)));
    const offset = (page - 1) * limit;

    let query = supabase
      .from("support_tickets")
      .select("id, ticket_number, studio_id, subject, description, status, priority, created_by, created_at, updated_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);
    if (priority) query = query.eq("priority", priority);
    if (search) query = query.or(`subject.ilike.%${search}%,description.ilike.%${search}%`);

    const { data: tickets, count: totalCount, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const studioIds = Array.from(new Set((tickets || []).map((t) => t.studio_id).filter(Boolean))) as string[];
    const { data: studios } =
      studioIds.length > 0 ? await supabase.from("studios").select("id, name").in("id", studioIds) : { data: [] };
    const studioNames = (studios || []).reduce((acc, s) => ({ ...acc, [s.id]: s.name }), {} as Record<string, string>);

    const list = (tickets || []).map((t) => ({
      ...t,
      studio_name: t.studio_id ? studioNames[t.studio_id] ?? null : null,
    }));

    return NextResponse.json({
      tickets: list,
      total: totalCount ?? 0,
      page,
      limit,
    });
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
