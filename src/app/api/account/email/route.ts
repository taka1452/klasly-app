import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/account/email
 * Initiates an email change. Supabase sends a confirmation email to the new
 * address; the change takes effect once the user clicks the confirmation link.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const newEmail = typeof body?.email === "string" ? body.email.trim() : "";

  if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return NextResponse.json(
      { error: "Please enter a valid email address" },
      { status: 400 }
    );
  }

  if (newEmail === user.email) {
    return NextResponse.json(
      { error: "This is already your current email" },
      { status: 400 }
    );
  }

  // Pre-check: another profile in this app already uses this email
  // (Supabase auth.users has its own uniqueness check but this surfaces a
  // cleaner error before the confirmation email round-trip.)
  const { data: duplicateProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", newEmail)
    .neq("id", user.id)
    .maybeSingle();
  if (duplicateProfile) {
    return NextResponse.json(
      { error: "This email is already in use by another account." },
      { status: 409 }
    );
  }

  const { error } = await supabase.auth.updateUser({ email: newEmail });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Sync profiles.email so dashboards, exports, and email templates that
  // read from profiles (not auth.users) show the new address. The
  // auth.users update above is the source of truth for sign-in; the
  // profiles row is a denormalized mirror used throughout the app.
  await supabase
    .from("profiles")
    .update({ email: newEmail })
    .eq("id", user.id);

  return NextResponse.json({
    success: true,
    message:
      "Confirmation emails have been sent. Check both your old and new inbox to complete the change.",
  });
}
