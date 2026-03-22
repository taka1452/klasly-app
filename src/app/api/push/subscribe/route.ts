import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/admin/supabase";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { endpoint, keys, studioId } = body;

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json(
      { error: "Invalid subscription data" },
      { status: 400 }
    );
  }

  const adminDb = createAdminClient();

  // デバイス名を User-Agent から推定
  const ua = request.headers.get("user-agent") || "";
  let deviceName = "Unknown";
  if (ua.includes("iPhone") || ua.includes("iPad")) {
    deviceName = ua.includes("CriOS") ? "Chrome iOS" : "Safari iOS";
  } else if (ua.includes("Android")) {
    deviceName = "Chrome Android";
  } else if (ua.includes("Firefox")) {
    deviceName = "Firefox Desktop";
  } else if (ua.includes("Chrome")) {
    deviceName = "Chrome Desktop";
  } else if (ua.includes("Safari")) {
    deviceName = "Safari Desktop";
  }

  // UPSERT: 同一 endpoint なら更新、なければ挿入
  const { data, error } = await adminDb
    .from("push_subscriptions")
    .upsert(
      {
        profile_id: user.id,
        studio_id: studioId || null,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: ua,
        device_name: deviceName,
        is_active: true,
        failed_count: 0,
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "profile_id,endpoint",
      }
    )
    .select("id")
    .single();

  if (error) {
    console.error("Push subscription error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data?.id });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { endpoint } = body;

  if (!endpoint) {
    return NextResponse.json({ error: "Endpoint required" }, { status: 400 });
  }

  const adminDb = createAdminClient();

  await adminDb
    .from("push_subscriptions")
    .update({ is_active: false })
    .eq("profile_id", user.id)
    .eq("endpoint", endpoint);

  return NextResponse.json({ success: true });
}
