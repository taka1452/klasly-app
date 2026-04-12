import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

type LogSupabaseClient = SupabaseClient;

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
  supabase: LogSupabaseClient,
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
    logger.error("insertWebhookLog failed", { eventType: row.event_type, error: err instanceof Error ? err.message : String(err) });
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
  supabase: LogSupabaseClient,
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
    logger.error("insertCronLog failed", { jobName: row.job_name, error: err instanceof Error ? err.message : String(err) });
  }
}

type AdminActionLogInsert = {
  action: string;
  studio_id: string | null;
  admin_email: string | null;
  details?: Record<string, unknown> | null;
  status: string;
  error_message?: string | null;
};

/**
 * Admin 操作を cron_logs テーブルに記録する。
 * (専用テーブルがないため job_name に "admin:" プレフィックスを付けて区別する)
 */
export async function insertAdminLog(
  supabase: LogSupabaseClient,
  row: AdminActionLogInsert
): Promise<void> {
  try {
    await supabase.from("cron_logs").insert({
      job_name: `admin:${row.action}`,
      status: row.status,
      affected_count: 1,
      details: {
        studio_id: row.studio_id,
        admin_email: row.admin_email,
        ...row.details,
      },
      error_message: row.error_message ?? null,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("insertAdminLog failed", {
      action: row.action,
      error: err instanceof Error ? err.message : String(err),
    });
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
  supabase: LogSupabaseClient,
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
    logger.error("insertEmailLog failed", { template: row.template, to: row.to_email, error: err instanceof Error ? err.message : String(err) });
  }
}
