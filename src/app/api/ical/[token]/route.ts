import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { buildIcs, type IcsEvent } from "@/lib/ical";

/**
 * GET /api/ical/<token>
 *
 * Public-but-unguessable iCalendar feed for the user that owns the token.
 * The token is a UUID stored on profiles.calendar_feed_token; it can be
 * regenerated or revoked by the user from Settings → Calendar feed.
 *
 * What's in the feed depends on the user's role:
 *   - Owner / Manager (any role)        → every non-cancelled session in the studio
 *   - Instructor (and "can teach" mgr)  → only their own sessions
 *   - Member                            → only sessions they've confirmed-booked
 *
 * Sessions are emitted with floating local times and X-WR-TIMEZONE set to
 * the studio's IANA timezone, so Google / Apple Calendar render the right
 * wall-clock time even for online classes.
 */

// We always re-read the feed live so subscribers see the latest.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const HORIZON_DAYS_FORWARD = 90;
const HORIZON_DAYS_BACKWARD = 14;

type SessionRow = {
  id: string;
  studio_id: string;
  class_id: string | null;
  instructor_id: string | null;
  session_date: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  is_cancelled: boolean | null;
  title: string | null;
  notes: string | null;
  online_link: string | null;
  location: string | null;
  is_online: boolean | null;
  updated_at: string | null;
  class_templates?: { name?: string | null } | null;
  rooms?: { name?: string | null; address?: string | null } | null;
  instructors?: { full_name?: string | null } | null;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token: rawToken } = await params;
  const token = (rawToken || "").replace(/\.ics$/i, "").trim();

  // Loose UUID check — fast-fail for obvious invalid hits.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return new Response("Not Found", { status: 404 });
  }

  const adminDb = createAdminClient();

  const { data: profile } = await adminDb
    .from("profiles")
    .select("id, role, full_name, studio_id")
    .eq("calendar_feed_token", token)
    .single();

  if (!profile?.studio_id) {
    return new Response("Not Found", { status: 404 });
  }

  const { data: studio } = await adminDb
    .from("studios")
    .select("name, timezone")
    .eq("id", profile.studio_id)
    .single();

  const studioName = studio?.name || "Klasly";
  const tz = studio?.timezone || "America/Los_Angeles";

  // Time horizon
  const now = new Date();
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - HORIZON_DAYS_BACKWARD);
  const toDate = new Date(now);
  toDate.setDate(toDate.getDate() + HORIZON_DAYS_FORWARD);

  const fromIso = fromDate.toISOString().slice(0, 10);
  const toIso = toDate.toISOString().slice(0, 10);

  // Fetch sessions with role-specific scoping.
  let sessions: SessionRow[] = [];

  if (profile.role === "owner" || profile.role === "manager") {
    sessions = await fetchStudioSessions(adminDb, profile.studio_id, fromIso, toIso);
  } else if (profile.role === "instructor") {
    sessions = await fetchInstructorSessions(
      adminDb,
      profile.id,
      profile.studio_id,
      fromIso,
      toIso
    );
  } else if (profile.role === "member") {
    sessions = await fetchMemberSessions(
      adminDb,
      profile.id,
      profile.studio_id,
      fromIso,
      toIso
    );
  }

  // Build the ics body
  const events: IcsEvent[] = sessions.map((s) => sessionToIcsEvent(s, studioName));

  const ics = buildIcs(events, {
    calendarName: `${studioName} — ${labelFor(profile.role)}`,
    calendarDescription:
      "Klasly schedule subscription. Updates pull automatically.",
    timezone: tz,
    refreshInterval: "PT1H",
  });

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${slug(studioName)}.ics"`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

// ---------- helpers ----------

import type { SupabaseClient } from "@supabase/supabase-js";

const SESSION_SELECT =
  "id, studio_id, class_id, instructor_id, session_date, start_time, end_time, duration_minutes, is_cancelled, title, notes, online_link, location, is_online, updated_at, class_templates(name), rooms(name, address), instructors(full_name)";

async function fetchStudioSessions(
  adminDb: SupabaseClient,
  studioId: string,
  fromIso: string,
  toIso: string
): Promise<SessionRow[]> {
  const { data } = await adminDb
    .from("class_sessions")
    .select(SESSION_SELECT)
    .eq("studio_id", studioId)
    .gte("session_date", fromIso)
    .lte("session_date", toIso)
    .order("session_date", { ascending: true })
    .order("start_time", { ascending: true });
  return (data ?? []) as unknown as SessionRow[];
}

async function fetchInstructorSessions(
  adminDb: SupabaseClient,
  profileId: string,
  studioId: string,
  fromIso: string,
  toIso: string
): Promise<SessionRow[]> {
  const { data: instructor } = await adminDb
    .from("instructors")
    .select("id")
    .eq("profile_id", profileId)
    .eq("studio_id", studioId)
    .maybeSingle();

  if (!instructor?.id) return [];

  const { data } = await adminDb
    .from("class_sessions")
    .select(SESSION_SELECT)
    .eq("studio_id", studioId)
    .eq("instructor_id", instructor.id)
    .gte("session_date", fromIso)
    .lte("session_date", toIso)
    .order("session_date", { ascending: true })
    .order("start_time", { ascending: true });
  return (data ?? []) as unknown as SessionRow[];
}

async function fetchMemberSessions(
  adminDb: SupabaseClient,
  profileId: string,
  studioId: string,
  fromIso: string,
  toIso: string
): Promise<SessionRow[]> {
  const { data: bookings } = await adminDb
    .from("bookings")
    .select("session_id")
    .eq("member_id", profileId)
    .in("status", ["confirmed", "waitlist"]);

  const sessionIds = (bookings ?? []).map((b: { session_id: string }) => b.session_id);
  if (sessionIds.length === 0) return [];

  const { data } = await adminDb
    .from("class_sessions")
    .select(SESSION_SELECT)
    .in("id", sessionIds)
    .eq("studio_id", studioId)
    .gte("session_date", fromIso)
    .lte("session_date", toIso)
    .order("session_date", { ascending: true })
    .order("start_time", { ascending: true });
  return (data ?? []) as unknown as SessionRow[];
}

function sessionToIcsEvent(s: SessionRow, studioName: string): IcsEvent {
  const start = `${s.session_date}T${(s.start_time || "00:00:00").slice(0, 8)}`;
  const end = computeEndLocal(s);
  const className =
    (s.title && s.title.trim()) ||
    s.class_templates?.name ||
    "Class";

  const summary = s.is_cancelled ? `[Cancelled] ${className}` : className;

  const descriptionLines: string[] = [];
  if (s.instructors?.full_name) {
    descriptionLines.push(`Instructor: ${s.instructors.full_name}`);
  }
  if (s.rooms?.name) {
    descriptionLines.push(`Room: ${s.rooms.name}`);
  }
  if (s.notes) {
    descriptionLines.push("");
    descriptionLines.push(s.notes);
  }
  descriptionLines.push("");
  descriptionLines.push(`Studio: ${studioName}`);

  const location = s.is_online
    ? s.online_link || "Online"
    : s.location || s.rooms?.address || s.rooms?.name || "";

  return {
    uid: `klasly-session-${s.id}@klasly.app`,
    startLocal: start,
    endLocal: end,
    summary,
    description: descriptionLines.join("\n"),
    location: location || undefined,
    status: s.is_cancelled ? "CANCELLED" : "CONFIRMED",
    lastModified: s.updated_at ?? undefined,
  };
}

function computeEndLocal(s: SessionRow): string {
  if (s.end_time) {
    return `${s.session_date}T${s.end_time.slice(0, 8)}`;
  }
  // Fallback to duration_minutes (default 60).
  const minutes = s.duration_minutes ?? 60;
  const [h, m, sec = "00"] = (s.start_time || "00:00:00").split(":");
  const total = parseInt(h, 10) * 60 + parseInt(m, 10) + minutes;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${s.session_date}T${pad(eh)}:${pad(em)}:${sec.slice(0, 2)}`;
}

function labelFor(role: string): string {
  switch (role) {
    case "owner":
      return "All Sessions";
    case "manager":
      return "All Sessions";
    case "instructor":
      return "My Classes";
    case "member":
      return "My Bookings";
    default:
      return "Schedule";
  }
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "klasly";
}
