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

  const { error } = await supabase.auth.updateUser({ email: newEmail });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message:
      "Confirmation emails have been sent. Check both your old and new inbox to complete the change.",
  });
}
