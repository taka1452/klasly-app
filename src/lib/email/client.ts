import { Resend } from "resend";

/**
 * Resend メールクライアント
 * 無料プランではドメイン検証前は onboarding@resend.dev から送信される
 * 本番では klasly.app ドメインを検証し、notifications@klasly.app を使用
 */
const resend = new Resend(process.env.RESEND_API_KEY);

export const FROM_EMAIL = "Klasly <onboarding@resend.dev>";
// 本番で klasly.app ドメイン検証後:
// export const FROM_EMAIL = "Klasly <notifications@klasly.app>";

export { resend };
