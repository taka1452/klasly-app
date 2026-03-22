import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/admin/supabase";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studioId = request.nextUrl.searchParams.get("studioId");

  const adminDb = createAdminClient();
  const { data } = await adminDb
    .from("notification_preferences")
    .select("*")
    .eq("profile_id", user.id)
    .eq("studio_id", studioId ?? "")
    .maybeSingle();

  // デフォルト値（レコードがない場合は全てON）
  const defaults = {
    booking_confirmation: true,
    booking_cancellation: true,
    class_reminder: true,
    waitlist_promotion: true,
    new_message: true,
    studio_announcement: true,
    push_enabled: true,
    email_enabled: true,
  };

  return NextResponse.json(data || defaults);
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { studioId, ...preferences } = body;

  const adminDb = createAdminClient();

  const { data, error } = await adminDb
    .from("notification_preferences")
    .upsert(
      {
        profile_id: user.id,
        studio_id: studioId || null,
        ...preferences,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "profile_id,studio_id",
      }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
