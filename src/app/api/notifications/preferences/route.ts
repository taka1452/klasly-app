import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id) {
    return NextResponse.json({ error: "No studio" }, { status: 400 });
  }

  let { data: prefs } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("profile_id", user.id)
    .eq("studio_id", profile.studio_id)
    .single();

  if (!prefs) {
    const { data: newPrefs } = await supabase
      .from("notification_preferences")
      .insert({
        profile_id: user.id,
        studio_id: profile.studio_id,
      })
      .select()
      .single();
    prefs = newPrefs;
  }

  return NextResponse.json(prefs);
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const allowedFields = [
    "email_booking_confirmation",
    "email_booking_cancellation",
    "email_class_changes",
    "email_payment_receipts",
    "email_waiver_requests",
    "email_new_messages",
    "email_waitlist_promotion",
    "email_event_reminders",
    "email_instructor_bookings",
  ];

  const updates: Record<string, boolean | string> = {};
  for (const field of allowedFields) {
    if (typeof body[field] === "boolean") {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("notification_preferences")
    .update(updates)
    .eq("profile_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
