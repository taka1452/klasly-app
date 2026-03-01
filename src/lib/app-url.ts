/**
 * アプリの正規URL（マジックリンク・リダイレクト用）。
 * 本番: NEXT_PUBLIC_APP_URL または Vercel の VERCEL_URL。ローカル: localhost。
 */
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
