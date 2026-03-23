import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import { sendEmail } from "@/lib/email/send";
import { z } from "zod";
import { parseBody } from "@/lib/api/parse-body";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ studioId: string }> }
) {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const { studioId } = await params;

    const schema = z.object({
      subject: z.string(),
      body: z.string().optional(),
      html: z.string().optional(),
    });
    const body = await parseBody(request, schema);
    if (body instanceof NextResponse) return body;
    const subject = body.subject.trim();
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
    const ok = await sendEmail({
      to: toEmail,
      subject,
      html,
      studioId,
      templateName: "admin_send",
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
