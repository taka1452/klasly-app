import { createClient } from "@supabase/supabase-js";

/** Allowed notification types that map to email_* columns */
const VALID_NOTIFICATION_TYPES = [
  "booking_confirmation",
  "booking_cancellation",
  "class_changes",
  "payment_receipts",
  "waiver_requests",
  "new_messages",
  "waitlist_promotion",
  "event_reminders",
  // Legacy aliases — kept so existing callers that pass these strings still
  // fall through to the shouldSendEmail warning/default-true path rather than
  // silently failing to send.
  "booking_cancelled",
  "waitlist_promoted",
  "payment_receipt",
  "payment_failed",
  "welcome_member",
  "waiver_invite",
  "instructor_invite",
  "message_notification",
  "class_reminder",
] as const;

type NotificationType = (typeof VALID_NOTIFICATION_TYPES)[number];

/**
 * Check if an email notification should be sent based on user preferences.
 * Returns true if the email should be sent, false if it should be skipped.
 * Defaults to true if no preferences record exists.
 */
export async function shouldSendEmail(
  profileId: string,
  studioId: string,
  notificationType: string
): Promise<boolean> {
  // Validate against whitelist to prevent dynamic column injection
  if (
    !VALID_NOTIFICATION_TYPES.includes(notificationType as NotificationType)
  ) {
    console.warn(
      `[shouldSendEmail] Unknown notification type: ${notificationType}`
    );
    return true;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const columnName = `email_${notificationType}`;

  const { data } = await supabase
    .from("notification_preferences")
    .select(columnName)
    .eq("profile_id", profileId)
    .eq("studio_id", studioId)
    .single();

  if (!data) return true;

  // 動的カラム名アクセスのため、Supabaseの型推論を回避
  const row = data as unknown as Record<string, boolean | undefined>;
  return row[columnName] !== false;
}
