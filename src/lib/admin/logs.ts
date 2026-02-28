import type { SupabaseClient } from "@supabase/supabase-js";

type WebhookLogInsert = {
  event_type: string;
  event_id: string | null;
  studio_id: string | null;
  status: string;
  payload?: Record<string, unknown> | null;
  error_message?: string | null;
};

/**
 * Webhook 処理結果を webhook_logs に挿入する。
 * supabase は service role クライアントを渡す。
 */
export async function insertWebhookLog(
  supabase: SupabaseClient,
  row: WebhookLogInsert
): Promise<void> {
  try {
    await supabase.from("webhook_logs").insert({
      event_type: row.event_type,
      event_id: row.event_id ?? null,
      studio_id: row.studio_id ?? null,
      status: row.status,
      payload: row.payload ?? null,
      error_message: row.error_message ?? null,
    });
  } catch (err) {
    console.error("[Logs] insertWebhookLog failed:", err);
  }
}

type CronLogInsert = {
  job_name: string;
  status: string;
  affected_count?: number;
  details?: Record<string, unknown> | null;
  error_message?: string | null;
  started_at?: string;
  completed_at?: string | null;
};

/**
 * Cron ジョブ結果を cron_logs に挿入する。
 */
export async function insertCronLog(
  supabase: SupabaseClient,
  row: CronLogInsert
): Promise<void> {
  try {
    const now = new Date().toISOString();
    await supabase.from("cron_logs").insert({
      job_name: row.job_name,
      status: row.status,
      affected_count: row.affected_count ?? 0,
      details: row.details ?? null,
      error_message: row.error_message ?? null,
      started_at: row.started_at ?? now,
      completed_at: row.completed_at ?? now,
    });
  } catch (err) {
    console.error("[Logs] insertCronLog failed:", err);
  }
}

type EmailLogInsert = {
  studio_id: string | null;
  to_email: string;
  template: string;
  subject: string | null;
  status: string;
  resend_id?: string | null;
  error_message?: string | null;
};

/**
 * メール送信結果を email_logs に挿入する。
 */
export async function insertEmailLog(
  supabase: SupabaseClient,
  row: EmailLogInsert
): Promise<void> {
  try {
    await supabase.from("email_logs").insert({
      studio_id: row.studio_id ?? null,
      to_email: row.to_email,
      template: row.template,
      subject: row.subject ?? null,
      status: row.status,
      resend_id: row.resend_id ?? null,
      error_message: row.error_message ?? null,
    });
  } catch (err) {
    console.error("[Logs] insertEmailLog failed:", err);
  }
}
