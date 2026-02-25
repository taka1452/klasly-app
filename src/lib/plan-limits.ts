import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Klasly プラン別会員上限
 * Free: 10, Studio: 50, Grow: 無制限
 */
export const PLAN_MEMBER_LIMITS: Record<string, number> = {
  free: 10,
  studio: 50,
  grow: Infinity,
};

export type PlanLimitResult = {
  allowed: boolean;
  currentCount: number;
  limit: number;
  plan: string;
};

/**
 * スタジオの会員数がプラン上限を超えていないかチェック
 */
export async function checkPlanLimit(
  supabase: SupabaseClient,
  studioId: string
): Promise<PlanLimitResult> {
  const { data: studio } = await supabase
    .from("studios")
    .select("plan")
    .eq("id", studioId)
    .single();

  const plan = studio?.plan || "free";
  const limit = PLAN_MEMBER_LIMITS[plan] ?? 10;

  if (limit === Infinity) {
    const { count } = await supabase
      .from("members")
      .select("*", { count: "exact", head: true })
      .eq("studio_id", studioId);
    return {
      allowed: true,
      currentCount: count ?? 0,
      limit: Infinity,
      plan,
    };
  }

  const { count } = await supabase
    .from("members")
    .select("*", { count: "exact", head: true })
    .eq("studio_id", studioId);

  const currentCount = count ?? 0;

  return {
    allowed: currentCount < limit,
    currentCount,
    limit,
    plan,
  };
}
