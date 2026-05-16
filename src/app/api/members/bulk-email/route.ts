import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/send";
import { baseStudioMessage } from "@/lib/email/templates";

/**
 * POST /api/members/bulk-email
 * Send a custom email to every active member matching an optional tag
 * filter. Owner only (or manager with messaging permission). Subject
 * and plain-text body are admin-authored; body line breaks are
 * preserved when rendered.
 */
export async function POST(request: Request) {
  const ctx = await getDashboardContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role === "manager" && !ctx.permissions?.can_send_messages) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const bodyText = typeof body.body === "string" ? body.body.trim() : "";
  const tagFilter =
    typeof body.tag === "string" && body.tag.trim() && body.tag !== "all"
      ? body.tag.trim()
      : null;

  if (!subject) {
    return NextResponse.json({ error: "Subject is required" }, { status: 400 });
  }
  if (!bodyText) {
    return NextResponse.json({ error: "Body is required" }, { status: 400 });
  }

  // Resolve recipient list.
  let query = ctx.supabase
    .from("members")
    .select("id, profile_id, status, tags, profiles(full_name, email)")
    .eq("studio_id", ctx.studioId)
    .eq("status", "active");
  if (tagFilter) {
    query = query.contains("tags", [tagFilter]);
  }
  const { data: members, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: studio } = await ctx.supabase
    .from("studios")
    .select("name")
    .eq("id", ctx.studioId)
    .single();
  const studioName = studio?.name || "Your studio";

  let sent = 0;
  let skipped = 0;

  for (const m of members ?? []) {
    const raw = (m as { profiles?: unknown }).profiles;
    const profile = (Array.isArray(raw) ? raw[0] : raw) as
      | { full_name?: string; email?: string }
      | null;
    if (!profile?.email) {
      skipped++;
      continue;
    }
    const { subject: subj, html } = baseStudioMessage({
      memberName: profile.full_name || "there",
      studioName,
      subject,
      body: bodyText,
    });
    try {
      await sendEmail({
        to: profile.email,
        subject: subj,
        html,
        studioId: ctx.studioId,
        templateName: "members_bulk_email",
      });
      sent++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ sent, skipped, total: members?.length ?? 0 });
}
