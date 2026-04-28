import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { sendPushNotification } from "@/lib/push/send";

export const runtime = "nodejs";
export const maxDuration = 120;

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

const IDLE_DAYS_THRESHOLD = 21;
const NUDGE_COOLDOWN_DAYS = 60;
const CARD_VISIBLE_DAYS = 7;

/**
 * Daily comeback nudge. Finds members who:
 *   - belong to a studio with extension.member_levels enabled
 *   - have last_attended_week ≥ 21 days ago
 *   - have not been nudged in the past 60 days (comeback_card_until older)
 *   - status = 'active' (don't nudge cancelled members)
 *
 * For each match:
 *   - Sets comeback_card_until = now + 7 days so /my-bookings shows
 *     a Welcome Back card
 *   - Sends a push notification (if subscribed and notifications on)
 *
 * The attendance trigger clears comeback_card_until on next visit.
 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminDb = createAdminClient();
  const now = new Date();
  const idleCutoff = new Date(now);
  idleCutoff.setUTCDate(now.getUTCDate() - IDLE_DAYS_THRESHOLD);
  const idleCutoffWeek = new Date(idleCutoff);
  idleCutoffWeek.setUTCDate(
    idleCutoffWeek.getUTCDate() - ((idleCutoffWeek.getUTCDay() + 6) % 7)
  );
  const cutoffIso = idleCutoffWeek.toISOString().slice(0, 10);

  const cooldownCutoff = new Date(now);
  cooldownCutoff.setUTCDate(now.getUTCDate() - NUDGE_COOLDOWN_DAYS);

  // Find studios with member_levels enabled
  const { data: enabledStudios } = await adminDb
    .from("studio_features")
    .select("studio_id")
    .eq("feature_key", "extension.member_levels")
    .eq("enabled", true);

  const studioIds = (enabledStudios ?? []).map((r) => r.studio_id);
  if (studioIds.length === 0) {
    return NextResponse.json({ ok: true, nudged: 0, reason: "no_enabled_studios" });
  }

  // Candidates
  const { data: candidates, error } = await adminDb
    .from("members")
    .select("id, profile_id, studio_id, last_attended_week, comeback_card_until")
    .in("studio_id", studioIds)
    .eq("status", "active")
    .not("last_attended_week", "is", null)
    .lt("last_attended_week", cutoffIso)
    .or(
      `comeback_card_until.is.null,comeback_card_until.lt.${cooldownCutoff.toISOString()}`
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const cardUntil = new Date(now);
  cardUntil.setUTCDate(now.getUTCDate() + CARD_VISIBLE_DAYS);
  const cardUntilIso = cardUntil.toISOString();

  let nudged = 0;
  let pushSent = 0;
  const failures: string[] = [];

  for (const m of candidates ?? []) {
    try {
      const { error: updErr } = await adminDb
        .from("members")
        .update({ comeback_card_until: cardUntilIso })
        .eq("id", m.id);
      if (updErr) {
        failures.push(`${m.id}:update:${updErr.message}`);
        continue;
      }
      nudged += 1;

      const result = await sendPushNotification({
        profileId: m.profile_id,
        studioId: m.studio_id,
        type: "studio_announcement",
        payload: {
          title: "We miss you on the mat",
          body: "Welcome back — your studio's saved a spot for you.",
          url: "/my-bookings",
          tag: `comeback-${m.id}`,
        },
      });
      if (result.sent && result.sent > 0) pushSent += 1;
    } catch (e) {
      failures.push(`${m.id}:${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: candidates?.length ?? 0,
    nudged,
    pushSent,
    failures: failures.length,
  });
}
