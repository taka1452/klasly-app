import { resend, FROM_EMAIL } from "./client";
import { createAdminClient } from "@/lib/admin/supabase";

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  from?: string;
  /** メールログ用（オプション） */
  studioId?: string | null;
  templateName?: string;
};

/**
 * メール送信ヘルパー
 * 送信失敗してもアプリの処理は止めない（try-catchでログ出力のみ）
 */
export async function sendEmail({
  to,
  subject,
  html,
  from = FROM_EMAIL,
  studioId = null,
  templateName = "unknown",
}: SendEmailParams): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[Email] RESEND_API_KEY is not set. Skipping email send.");
    return false;
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });

    try {
      const adminDb = createAdminClient();
      await adminDb.from("email_logs").insert({
        studio_id: studioId ?? null,
        to_email: to,
        template: templateName,
        subject,
        status: error ? "failed" : "sent",
        resend_id: data?.id ?? null,
        error_message: error?.message ?? null,
      });
    } catch {
      // ログ記録失敗はメイン処理をブロックしない
      console.error("[Email] Failed to write email log");
    }

    if (error) {
      console.error("[Email] Send failed:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[Email] Send error:", err);
    return false;
  }
}
