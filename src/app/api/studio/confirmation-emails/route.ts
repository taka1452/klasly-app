import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/send";
import {
  bookingConfirmation,
  eventBookingConfirmedFull,
} from "@/lib/email/templates";

/**
 * PUT /api/studio/confirmation-emails — owner-only settings for the
 * studio-wide default confirmation email subject/body (one pair for
 * class bookings, one for event bookings). Per-class overrides on
 * class_templates / events take priority over these.
 */
export async function PUT(request: Request) {
  const ctx = await getDashboardContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  const fields = [
    "class_confirmation_subject",
    "class_confirmation_body",
    "event_confirmation_subject",
    "event_confirmation_body",
    "confirmation_sender_name",
  ];
  for (const key of fields) {
    if (body[key] === undefined) continue;
    if (typeof body[key] === "string" && body[key].trim()) {
      updates[key] = body[key].trim();
    } else {
      updates[key] = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await ctx.supabase
    .from("studios")
    .update(updates)
    .eq("id", ctx.studioId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

/**
 * POST /api/studio/confirmation-emails — send a preview email to the
 * current owner so they can sanity-check subject / body / variables
 * before saving. Uses the same template renderer the real bookings
 * use, with sample variable values.
 */
export async function POST(request: Request) {
  const ctx = await getDashboardContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const kind = body.kind as "class" | "event" | undefined;
  if (kind !== "class" && kind !== "event") {
    return NextResponse.json(
      { error: "kind must be 'class' or 'event'" },
      { status: 400 }
    );
  }

  const overrideSubject =
    typeof body.subject === "string" && body.subject.trim()
      ? body.subject.trim()
      : null;
  const overrideBody =
    typeof body.body === "string" && body.body.trim() ? body.body.trim() : null;

  const { data: studio } = await ctx.supabase
    .from("studios")
    .select("name")
    .eq("id", ctx.studioId)
    .single();
  const studioName = studio?.name ?? "Your studio";

  const { data: ownerProfile } = await ctx.supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", ctx.userId)
    .single();
  const toEmail = ownerProfile?.email;
  if (!toEmail) {
    return NextResponse.json({ error: "Owner email not found" }, { status: 400 });
  }

  const sampleVars = {
    memberName: ownerProfile?.full_name ?? "Sample Member",
    className: kind === "event" ? "Bali Retreat — Sample" : "Morning Vinyasa — Sample",
    sessionDate: "2026-06-01",
    startTime: "7:00 AM",
    studioName,
  };

  let email: { subject: string; html: string };
  if (kind === "class") {
    email = bookingConfirmation({
      memberName: sampleVars.memberName,
      className: sampleVars.className,
      sessionDate: sampleVars.sessionDate,
      startTime: sampleVars.startTime,
      studioName: sampleVars.studioName,
      isOnline: false,
      onlineLink: null,
      overrideSubject,
      overrideBody,
    });
  } else {
    email = eventBookingConfirmedFull({
      guestName: sampleVars.memberName,
      eventName: sampleVars.className,
      startDate: sampleVars.sessionDate,
      endDate: "2026-06-04",
      locationName: "Studio Sample",
      optionName: "Shared Room",
      amountCents: 120000,
      cancellationPolicySummary: "Full refund 30 days before. 50% within 30 days.",
      overrideSubject,
      overrideBody,
      studioName,
    });
  }

  await sendEmail({
    to: toEmail,
    subject: `[Preview] ${email.subject}`,
    html: email.html,
    studioId: ctx.studioId,
    templateName: `confirmation_email_preview_${kind}`,
  });

  return NextResponse.json({ success: true, sent_to: toEmail });
}
