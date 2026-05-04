import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { sendEmail } from "@/lib/email/send";
import { messageNotification } from "@/lib/email/templates";
import { sendPushNotification } from "@/lib/push/send";
import { pushNewMessage } from "@/lib/push/templates";

/**
 * POST /api/messages/broadcast
 * Body: { recipient_ids?: string[]; all?: boolean; content: string; subject?: string }
 *
 * Sends a single message body to N members at once. Implementation: one row
 * per recipient in `messages` (so each member's inbox stays a normal 1:1
 * thread). Email + push notifications fan out the same way an individual
 * send does.
 *
 * Restricted to owner / manager-with-can_send_messages.
 */
export async function POST(request: NextRequest) {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    recipient_ids?: string[];
    all?: boolean;
    content: string;
    subject?: string;
  };

  const { content, subject } = body;
  if (!content?.trim()) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  const adminDb = createAdminClient();
  const { data: senderProfile } = await adminDb
    .from("profiles")
    .select("id, full_name, email, role, studio_id")
    .eq("id", user.id)
    .single();

  if (!senderProfile?.studio_id) {
    return NextResponse.json({ error: "No studio" }, { status: 400 });
  }

  const studioId = senderProfile.studio_id as string;

  // Authorization: owner always; manager only with can_send_messages.
  let allowed = senderProfile.role === "owner";
  if (!allowed && senderProfile.role === "manager") {
    const { data: mgr } = await adminDb
      .from("managers")
      .select("can_send_messages")
      .eq("profile_id", user.id)
      .eq("studio_id", studioId)
      .single();
    allowed = !!mgr?.can_send_messages;
  }
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Resolve recipient list.
  let recipientIds: string[] = [];
  if (body.all) {
    const { data: members } = await adminDb
      .from("members")
      .select("profile_id")
      .eq("studio_id", studioId)
      .eq("status", "active");
    recipientIds = (members ?? [])
      .map((m) => m.profile_id)
      .filter((v): v is string => !!v);
  } else if (Array.isArray(body.recipient_ids)) {
    recipientIds = body.recipient_ids.filter(
      (v): v is string => typeof v === "string" && v.length > 0,
    );
  }

  if (recipientIds.length === 0) {
    return NextResponse.json({ error: "No recipients" }, { status: 400 });
  }

  // Fetch all recipient profiles in one query and validate studio.
  const { data: recipientProfiles } = await adminDb
    .from("profiles")
    .select("id, full_name, email, role, studio_id")
    .in("id", recipientIds);

  const validRecipients = (recipientProfiles ?? []).filter(
    (p) => p.studio_id === studioId,
  );
  if (validRecipients.length === 0) {
    return NextResponse.json({ error: "No valid recipients" }, { status: 400 });
  }

  // Insert one row per recipient.
  const rows = validRecipients.map((p) => ({
    studio_id: studioId,
    sender_id: user.id,
    recipient_id: p.id,
    content: content.trim(),
    subject: subject?.trim() || null,
  }));

  const { error: insertErr } = await adminDb.from("messages").insert(rows);
  if (insertErr) {
    console.error("[broadcast]", insertErr);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Fan-out notifications (best effort — don't fail the request on a single
  // notification error).
  const { data: studio } = await adminDb
    .from("studios")
    .select("name")
    .eq("id", studioId)
    .single();

  const senderName =
    senderProfile.full_name || senderProfile.email || "Studio";
  const studioName = studio?.name || "Studio";

  await Promise.allSettled(
    validRecipients.map(async (p) => {
      if (p.email) {
        const template = messageNotification({
          recipientName: p.full_name || p.email || "Member",
          senderName,
          preview: content.trim(),
          studioName,
        });
        await sendEmail({
          to: p.email,
          subject: template.subject,
          html: template.html,
          studioId,
          templateName: "message_notification",
        });
      }
      await sendPushNotification({
        profileId: p.id,
        studioId,
        type: "new_message",
        payload: pushNewMessage({ senderName }),
      });
    }),
  );

  return NextResponse.json({ sent: validRecipients.length }, { status: 201 });
}
