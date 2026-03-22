import webpush from "web-push";
import { createAdminClient } from "@/lib/admin/supabase";
import type { PushNotificationType } from "@/types/database";

// VAPID 設定（遅延初期化 — ビルド時に環境変数がなくてもエラーにならない）
let vapidConfigured = false;
function ensureVapidConfigured() {
  if (vapidConfigured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.warn("VAPID keys not set — push notifications will be skipped");
    return;
  }
  webpush.setVapidDetails("mailto:support@klasly.app", publicKey, privateKey);
  vapidConfigured = true;
}

type PushPayload = {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
};

type SendPushParams = {
  profileId: string;
  studioId?: string;
  type: PushNotificationType;
  payload: PushPayload;
};

/**
 * 指定ユーザーの全アクティブデバイスに Push 通知を送信
 */
export async function sendPushNotification(params: SendPushParams) {
  ensureVapidConfigured();
  if (!vapidConfigured) return { sent: 0, skipped: "vapid_not_configured" };

  const { profileId, studioId, type, payload } = params;
  const supabase = createAdminClient();

  // 1. 通知設定を確認
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("profile_id", profileId)
    .eq("studio_id", studioId ?? "")
    .maybeSingle();

  // 通知設定がない場合はデフォルト（全てON）
  if (prefs) {
    if (!prefs.push_enabled) return { sent: 0, skipped: "push_disabled" };
    if (type in prefs && !(prefs as Record<string, unknown>)[type]) {
      return { sent: 0, skipped: `${type}_disabled` };
    }
  }

  // 2. アクティブなサブスクリプションを取得
  let query = supabase
    .from("push_subscriptions")
    .select("*")
    .eq("profile_id", profileId)
    .eq("is_active", true);

  if (studioId) {
    query = query.eq("studio_id", studioId);
  }

  const { data: subscriptions } = await query;

  if (!subscriptions?.length) {
    return { sent: 0, skipped: "no_subscriptions" };
  }

  // 3. デフォルト値を設定
  const pushPayload: PushPayload = {
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    ...payload,
  };

  // 4. 全デバイスに送信
  let sentCount = 0;
  const errors: string[] = [];

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify(pushPayload),
        {
          TTL: 60 * 60 * 24, // 24時間
          urgency: type === "class_reminder" ? "high" : "normal",
        }
      );

      // 成功: last_used_at を更新、failed_count をリセット
      await supabase
        .from("push_subscriptions")
        .update({
          last_used_at: new Date().toISOString(),
          failed_count: 0,
        })
        .eq("id", sub.id);

      sentCount++;
    } catch (error: unknown) {
      const statusCode =
        error && typeof error === "object" && "statusCode" in error
          ? (error as { statusCode: number }).statusCode
          : 0;
      const errMsg = error instanceof Error ? error.message : "Unknown error";

      if (statusCode === 410 || statusCode === 404) {
        // サブスクリプションが無効（ユーザーが通知をブロック or 再インストール）
        await supabase
          .from("push_subscriptions")
          .update({ is_active: false })
          .eq("id", sub.id);
      } else {
        // その他のエラー: failed_count をインクリメント
        const newCount = (sub.failed_count || 0) + 1;
        await supabase
          .from("push_subscriptions")
          .update({
            failed_count: newCount,
            is_active: newCount < 3,
          })
          .eq("id", sub.id);
      }

      errors.push(`${sub.id}: ${errMsg}`);
    }
  }

  // 5. ログ記録
  await supabase.from("push_logs").insert({
    studio_id: studioId || null,
    profile_id: profileId,
    notification_type: type,
    title: payload.title,
    body: payload.body,
    status: sentCount > 0 ? "sent" : "failed",
    error_message: errors.length > 0 ? errors.join("; ") : null,
  });

  return { sent: sentCount, errors };
}

/**
 * スタジオの全メンバーに Push 通知を一斉送信
 */
export async function sendPushToStudioMembers(params: {
  studioId: string;
  type: PushNotificationType;
  payload: PushPayload;
  excludeProfileIds?: string[];
}) {
  const { studioId, type, payload, excludeProfileIds = [] } = params;
  const supabase = createAdminClient();

  const { data: members } = await supabase
    .from("members")
    .select("profile_id")
    .eq("studio_id", studioId)
    .eq("status", "active")
    .not("profile_id", "is", null);

  if (!members?.length) return { total: 0, sent: 0 };

  const profileIds = members
    .map((m) => m.profile_id)
    .filter(
      (id): id is string => id !== null && !excludeProfileIds.includes(id)
    );

  let totalSent = 0;
  for (const profileId of profileIds) {
    const result = await sendPushNotification({
      profileId,
      studioId,
      type,
      payload,
    });
    totalSent += result.sent;
  }

  return { total: profileIds.length, sent: totalSent };
}
