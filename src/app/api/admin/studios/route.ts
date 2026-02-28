import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";

const LIMIT = 20;
const SORT_OPTIONS = ["newest", "oldest", "members", "name"] as const;

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const supabase = createAdminClient();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "all";
    const sort = (searchParams.get("sort") as (typeof SORT_OPTIONS)[number]) || "newest";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || String(LIMIT), 10)));
    const offset = (page - 1) * limit;

    let query = supabase
      .from("studios")
      .select("id, name, email, plan_status, subscription_period, trial_ends_at, created_at", { count: "exact" });

    if (status !== "all") {
      query = query.eq("plan_status", status);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    if (sort === "newest") {
      query = query.order("created_at", { ascending: false });
    } else if (sort === "oldest") {
      query = query.order("created_at", { ascending: true });
    } else if (sort === "name") {
      query = query.order("name", { ascending: true });
    }

    const { data: studios, count: totalCount, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const studioIds = (studios || []).map((s) => s.id);
    if (studioIds.length === 0) {
      return NextResponse.json({
        studios: [],
        total: totalCount ?? 0,
        page,
        limit,
      });
    }

    const { data: owners } = await supabase
      .from("profiles")
      .select("studio_id, full_name, email")
      .in("studio_id", studioIds)
      .eq("role", "owner");

    const ownerByStudio = (owners || []).reduce(
      (acc, o) => {
        if (o.studio_id) acc[o.studio_id] = o;
        return acc;
      },
      {} as Record<string, { full_name: string | null; email: string | null }>
    );

    const { data: memberCounts } = await supabase
      .from("members")
      .select("studio_id")
      .in("studio_id", studioIds)
      .eq("status", "active");

    const countByStudio = (memberCounts || []).reduce(
      (acc, m) => {
        acc[m.studio_id] = (acc[m.studio_id] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    let result = (studios || []).map((s) => ({
      ...s,
      owner_name: ownerByStudio[s.id]?.full_name ?? null,
      owner_email: ownerByStudio[s.id]?.email ?? null,
      members_count: countByStudio[s.id] ?? 0,
    }));

    if (sort === "members") {
      result = result.sort((a, b) => (b.members_count ?? 0) - (a.members_count ?? 0));
    }

    return NextResponse.json({
      studios: result,
      total: totalCount ?? 0,
      page,
      limit,
    });
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) {
      throw e;
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
