import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

async function getSupabase() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey) {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
  }
  return createServerClient();
}

export type PercentileScope = "studio" | "system";

export type PercentileResult = {
  scope: PercentileScope;
  // 1 = top 1%, 100 = bottom. null when there's not enough data (single member).
  topPercent: number | null;
  totalMembers: number;
};

/**
 * Compute the member's percentile rank by lifetime_classes_attended.
 * Returns "top X%" semantics — lower number = better. Returns null when
 * the comparison group is too small (≤1 member) to be meaningful.
 *
 * Privacy: never returns names or other members' counts. Only the
 * aggregate percentile and group size.
 */
export async function getMemberPercentile(
  memberId: string,
  scope: PercentileScope
): Promise<PercentileResult> {
  const supabase = await getSupabase();

  const { data: me } = await supabase
    .from("members")
    .select("lifetime_classes_attended, studio_id")
    .eq("id", memberId)
    .single();

  if (!me) {
    return { scope, topPercent: null, totalMembers: 0 };
  }

  const myCount = me.lifetime_classes_attended ?? 0;

  let query = supabase
    .from("members")
    .select("lifetime_classes_attended", { count: "exact" });

  if (scope === "studio") {
    query = query.eq("studio_id", me.studio_id);
  }

  const { data: rows, count } = await query;
  const total = count ?? rows?.length ?? 0;
  if (total <= 1 || !rows) {
    return { scope, topPercent: null, totalMembers: total };
  }

  // How many members are strictly *above* me by lifetime count.
  let above = 0;
  for (const r of rows) {
    if ((r.lifetime_classes_attended ?? 0) > myCount) above++;
  }

  // Top percentile: 1 + (number above) / total, clamped to [1, 100].
  // E.g. nobody above → top 1%. Half above → top ~51%.
  const raw = ((above + 1) / total) * 100;
  const topPercent = Math.max(1, Math.min(100, Math.round(raw)));

  return { scope, topPercent, totalMembers: total };
}
