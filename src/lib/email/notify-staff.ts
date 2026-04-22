import { createAdminClient } from "@/lib/admin/supabase";
import { sendEmail } from "@/lib/email/send";
import { shouldSendEmail } from "@/lib/email/check-preference";
import { instructorBookingStaffNotice } from "@/lib/email/templates";

type Recipient = { profileId: string; email: string; fullName: string | null };

async function getOwnersAndManagers(studioId: string): Promise<Recipient[]> {
  const db = createAdminClient();
  const recipients: Recipient[] = [];
  const seen = new Set<string>();

  // Owner
  const { data: owner } = await db
    .from("profiles")
    .select("id, email, full_name")
    .eq("studio_id", studioId)
    .eq("role", "owner")
    .maybeSingle();

  if (owner?.email) {
    recipients.push({
      profileId: owner.id,
      email: owner.email,
      fullName: owner.full_name,
    });
    seen.add(owner.email);
  }

  // Managers (all of them — can opt out via email preferences)
  const { data: managers } = await db
    .from("managers")
    .select("profile_id, profiles(id, email, full_name)")
    .eq("studio_id", studioId);

  for (const m of managers ?? []) {
    const p = (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as {
      id: string;
      email: string | null;
      full_name: string | null;
    } | null;
    if (p?.email && !seen.has(p.email)) {
      recipients.push({
        profileId: p.id,
        email: p.email,
        fullName: p.full_name,
      });
      seen.add(p.email);
    }
  }

  return recipients;
}

type NotifyPayload = {
  studioId: string;
  instructorName: string;
  activity: string;
  title: string;
  date: string;
  startTime: string;
  endTime?: string | null;
  location?: string | null;
  linkPath?: string;
};

/**
 * Fire-and-forget notification to the studio owner + all managers when
 * an instructor books something (class session / private appointment).
 * Respects each recipient's `email_instructor_bookings` preference.
 */
export async function notifyStaffOfInstructorBooking(
  payload: NotifyPayload
): Promise<void> {
  try {
    const db = createAdminClient();
    const { data: studio } = await db
      .from("studios")
      .select("name")
      .eq("id", payload.studioId)
      .maybeSingle();
    const studioName = studio?.name || "your studio";

    const recipients = await getOwnersAndManagers(payload.studioId);
    if (recipients.length === 0) return;

    await Promise.all(
      recipients.map(async (r) => {
        const allowed = await shouldSendEmail(
          r.profileId,
          payload.studioId,
          "instructor_bookings"
        );
        if (!allowed) return;

        const template = instructorBookingStaffNotice({
          recipientName: r.fullName || "there",
          instructorName: payload.instructorName,
          activity: payload.activity,
          title: payload.title,
          date: payload.date,
          startTime: payload.startTime,
          endTime: payload.endTime ?? null,
          location: payload.location ?? null,
          studioName,
          linkPath: payload.linkPath,
        });

        await sendEmail({
          to: r.email,
          subject: template.subject,
          html: template.html,
          studioId: payload.studioId,
          templateName: "instructorBookingStaffNotice",
        });
      })
    );
  } catch (err) {
    console.error("[notifyStaffOfInstructorBooking] failed:", err);
  }
}
