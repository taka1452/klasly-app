import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createHash } from "crypto";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const studio_id = searchParams.get("studio_id");
    const url = searchParams.get("url") || "";
    const utm_source = searchParams.get("utm_source") || null;
    const utm_medium = searchParams.get("utm_medium") || null;
    const utm_campaign = searchParams.get("utm_campaign") || null;

    if (!studio_id) {
      return NextResponse.json({ ok: true }); // silent fail
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ ok: true });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    // スタジオ存在確認
    const { data: studio } = await supabase
      .from("studios")
      .select("id")
      .eq("id", studio_id)
      .maybeSingle();

    if (!studio) {
      return NextResponse.json({ ok: true });
    }

    // IPハッシュ化
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "unknown";
    const ip_hash = createHash("sha256").update(ip).digest("hex").slice(0, 16);

    const user_agent = request.headers.get("user-agent") || null;
    const referrer = request.headers.get("referer") || null;

    // 重複排除: 同じ ip_hash + studio_id + utm_source で1時間以内
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from("link_clicks")
      .select("id")
      .eq("studio_id", studio_id)
      .eq("ip_hash", ip_hash)
      .eq("utm_source", utm_source || "")
      .gte("created_at", oneHourAgo)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ ok: true }); // 重複スキップ
    }

    await supabase.from("link_clicks").insert({
      studio_id,
      url,
      utm_source,
      utm_medium,
      utm_campaign,
      referrer,
      user_agent,
      ip_hash,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // silent fail
  }
}
