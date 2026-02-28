import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import { sendEmail } from "@/lib/email/send";
import { insertEmailLog } from "@/lib/admin/logs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ studioId: string }> }
) {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const { studioId } = await params;

    const body = await request.json().catch(() => ({}));
    const subject = (body.subject ?? "").trim();
    const bodyText = (body.body ?? body.html ?? "").trim();

    if (!subject || !bodyText) {
      return NextResponse.json(
        { error: "Subject and body are required" },
        { status: 400 }
      );
    }

    const { data: studio } = await supabase
      .from("studios")
      .select("id, name")
      .eq("id", studioId)
      .single();

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    const { data: owner } = await supabase
      .from("profiles")
      .select("email")
      .eq("studio_id", studioId)
      .eq("role", "owner")
      .single();

    const toEmail = owner?.email;
    if (!toEmail) {
      return NextResponse.json(
        { error: "No owner email found for this studio" },
        { status: 400 }
      );
    }

    const html = bodyText.replace(/\n/g, "<br>");
    const ok = await sendEmail({ to: toEmail, subject, html });
    await insertEmailLog(supabase, {
      studio_id: studioId,
      to_email: toEmail,
      template: "admin_send",
      subject,
      status: ok ? "sent" : "failed",
    });
    if (!ok) {
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
