import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { sendEmail } from "@/lib/email/send";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json().catch(() => ({}));
    const to = (body.to ?? "").trim();

    if (!to) {
      return NextResponse.json(
        { error: "Email address is required" },
        { status: 400 }
      );
    }
    if (!EMAIL_REGEX.test(to)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    const html = `
      <p>This is a test email from Klasly Admin.</p>
      <p>If you received this, email delivery is working.</p>
      <p><small>Sent at ${new Date().toISOString()}</small></p>
    `;
    const ok = await sendEmail({
      to,
      subject: "[Klasly] Test Email",
      html,
      templateName: "admin_test",
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
