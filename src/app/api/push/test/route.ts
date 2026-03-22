import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushNotification } from "@/lib/push/send";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Owner のみテスト送信可能
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["owner", "manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await sendPushNotification({
    profileId: user.id,
    type: "studio_announcement",
    payload: {
      title: "Test Notification",
      body: "Push notifications are working!",
      url: "/",
    },
  });

  return NextResponse.json(result);
}
