import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

export async function GET() {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = serviceRoleKey
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
      : serverSupabase;

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    if (!profile?.studio_id || !["owner", "manager"].includes(profile.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const analyticsEnabled = await isFeatureEnabled(profile.studio_id, FEATURE_KEYS.ANALYTICS);
    if (!analyticsEnabled) {
      return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: clicks } = await supabase
      .from("link_clicks")
      .select("utm_source, utm_medium, utm_campaign, created_at")
      .eq("studio_id", profile.studio_id)
      .gte("created_at", thirtyDaysAgo);

    if (!clicks || clicks.length === 0) {
      return NextResponse.json({
        sources: [],
        campaigns: [],
        total: 0,
      });
    }

    // Source集計
    const sourceMap = new Map<string, number>();
    const campaignMap = new Map<string, number>();

    for (const c of clicks) {
      const source = c.utm_source || "(direct)";
      sourceMap.set(source, (sourceMap.get(source) || 0) + 1);

      if (c.utm_campaign) {
        campaignMap.set(c.utm_campaign, (campaignMap.get(c.utm_campaign) || 0) + 1);
      }
    }

    const total = clicks.length;
    const sources = Array.from(sourceMap.entries())
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    const campaigns = Array.from(campaignMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return NextResponse.json({ sources, campaigns, total });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
