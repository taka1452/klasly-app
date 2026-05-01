import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { sendEmail } from "@/lib/email/send";
import { passwordReset } from "@/lib/email/templates";
import { getAppUrl } from "@/lib/app-url";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const origin = getAppUrl();

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${origin}/auth/callback?type=recovery` },
    });

    if (error || !data?.properties?.action_link) {
      return NextResponse.json({ success: true });
    }

    const resetUrl = data.properties.action_link;

    const { subject, html } = passwordReset({ resetUrl });
    await sendEmail({
      to: email,
      subject,
      html,
      templateName: "password_reset",
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
