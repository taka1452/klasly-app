import { resend, FROM_EMAIL } from "./client";

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  from?: string;
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
