import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/send";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id || !["owner", "manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get campaign
  const { data: campaign } = await supabase
    .from("email_campaigns")
    .select("id, subject, body, studio_id, status")
    .eq("id", campaignId)
    .eq("studio_id", profile.studio_id)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (campaign.status === "sent") {
    return NextResponse.json({ error: "Campaign already sent" }, { status: 400 });
  }

  // Mark as sending
  await supabase
    .from("email_campaigns")
    .update({ status: "sending" })
    .eq("id", campaignId);

  // Get all active members with email
  const { data: members } = await supabase
    .from("members")
    .select("id, profiles(email)")
    .eq("studio_id", profile.studio_id)
    .eq("status", "active");

  let sentCount = 0;
  const emails: string[] = [];

  (members || []).forEach((m) => {
    const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    const email = (prof as { email?: string })?.email;
    if (email) emails.push(email);
  });

  // Send in batches (10 per batch to respect rate limits)
  for (let i = 0; i < emails.length; i += 10) {
    const batch = emails.slice(i, i + 10);
    await Promise.allSettled(
      batch.map((email) =>
        sendEmail({
          to: email,
          subject: campaign.subject,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">${campaign.body.replace(/\n/g, "<br>")}</div>`,
        })
      )
    );
    sentCount += batch.length;
  }

  // Mark as sent
  await supabase
    .from("email_campaigns")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      sent_count: sentCount,
    })
    .eq("id", campaignId);

  return NextResponse.json({ success: true, sentCount });
}
