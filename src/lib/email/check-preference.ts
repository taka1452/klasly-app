import { createClient } from "@supabase/supabase-js";

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

  const value = (data as unknown as Record<string, boolean | undefined>)[columnName];
  return value !== false;
}
