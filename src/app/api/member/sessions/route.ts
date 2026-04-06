import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import { unwrapRelation } from "@/lib/supabase/relation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/member/sessions?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Returns sessions, member bookings, and confirmed counts for a date range.
 */
export async function GET(request: NextRequest) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json(
        { error: "start and end query params required" },
        { status: 400 },
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = serviceRoleKey
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
      : serverSupabase;

    // Get profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id")
      .eq("id", user.id)
      .single();

    if (!profile?.studio_id) {
      return NextResponse.json({ sessions: [], bookings: {}, confirmedCounts: {} });
    }

    const studioId = profile.studio_id;

    // Get member
    const { data: member } = await supabase
      .from("members")
      .select("id, credits")
      .eq("studio_id", studioId)
      .eq("profile_id", user.id)
      .single();

    const memberId = member?.id ?? null;
    const memberCredits = member?.credits ?? 0;

    // Fetch sessions with expanded class + instructor info
    type SessionRow = {
      id: string;
      class_id: string;
      session_date: string;
      start_time: string;
      capacity: number;
      is_cancelled: boolean;
      is_online?: boolean;
      online_link?: string | null;
      classes?: {
        id?: string;
        name?: string;
        duration_minutes?: number;
        location?: string;
        is_public?: boolean;
        price_cents?: number | null;
        room_id?: string | null;
        is_online?: boolean;
        online_link?: string | null;
        rooms?: { name?: string } | null;
        instructors?: {
          id?: string;
          profiles?: { full_name?: string };
        };
      };
    };

    const { data: sessions } = await supabase
      .from("class_sessions")
      .select(
        `
        id, class_id, session_date, start_time, capacity, is_cancelled, is_online, online_link,
        classes (
          id, name, duration_minutes, location, is_public, price_cents, room_id, is_online, online_link,
          rooms (name),
          instructors (
            id, profiles (full_name)
          )
        )
      `,
      )
      .eq("studio_id", studioId)
      .eq("is_cancelled", false)
      .eq("is_public", true)
      .gte("session_date", start)
      .lte("session_date", end)
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true });

    // Filter out non-public classes (private sessions should not appear on member schedule)
    const typedSessions = ((sessions ?? []) as SessionRow[]).filter(
      (s) => s.classes?.is_public !== false
    );
    const sessionIds = typedSessions.map((s) => s.id);

    // Fetch member bookings
    let bookingsMap: Record<string, { id: string; status: string }> = {};
    if (sessionIds.length > 0 && memberId) {
      const { data: bookings } = await supabase
        .from("bookings")
        .select("session_id, status, id")
        .eq("member_id", memberId)
        .in("session_id", sessionIds);

      if (bookings) {
        // Prioritize non-cancelled bookings: if a session has both cancelled and active bookings,
        // the active one should be shown (e.g. cancel then rebook scenario)
        bookingsMap = (bookings as { session_id: string; id: string; status: string }[]).reduce(
          (acc: Record<string, { id: string; status: string }>, b) => {
            const existing = acc[b.session_id];
            if (!existing || existing.status === "cancelled") {
              acc[b.session_id] = { id: b.id, status: b.status };
            }
            return acc;
          },
          {},
        );
      }
    }

    // Fetch confirmed counts
    let confirmedMap: Record<string, number> = {};
    if (sessionIds.length > 0) {
      const { data: confirmed } = await supabase
        .from("bookings")
        .select("session_id")
        .in("session_id", sessionIds)
        .eq("status", "confirmed");

      if (confirmed) {
        confirmedMap = (confirmed as { session_id: string }[]).reduce(
          (acc: Record<string, number>, b) => {
            acc[b.session_id] = (acc[b.session_id] || 0) + 1;
            return acc;
          },
          {},
        );
      }
    }

    // Format sessions
    const onlineEnabled = await isFeatureEnabled(studioId, FEATURE_KEYS.ONLINE_CLASSES);
    const formattedSessions = typedSessions.map((s) => {
      // Session-level online overrides class-level
      const isOnline = onlineEnabled ? (s.is_online ?? s.classes?.is_online ?? false) : false;
      // Only include online_link if member has a confirmed booking
      const memberBooking = memberId ? bookingsMap[s.id] : null;
      const hasConfirmed = memberBooking?.status === "confirmed";
      const rawLink = s.online_link ?? s.classes?.online_link ?? null;

      return {
        id: s.id,
        class_id: s.class_id ?? s.classes?.id ?? null,
        session_date: s.session_date,
        start_time: s.start_time,
        capacity: s.capacity,
        is_cancelled: s.is_cancelled,
        class_name: s.classes?.name ?? "Class",
        duration_minutes: s.classes?.duration_minutes ?? 60,
        instructor_id: s.classes?.instructors?.id ?? null,
        instructor_name: s.classes?.instructors?.profiles?.full_name ?? "",
        location: s.classes?.location ?? null,
        price_cents: s.classes?.price_cents ?? null,
        room_name: s.classes?.rooms?.name ?? null,
        is_online: isOnline,
        online_link: hasConfirmed ? rawLink : null,
      };
    });

    // Check for active pass subscription
    let passInfo: {
      hasPass: boolean;
      hasCapacity: boolean;
      classesUsed: number;
      maxClasses: number | null;
    } = { hasPass: false, hasCapacity: false, classesUsed: 0, maxClasses: null };

    if (memberId) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: passSubs } = await supabase
        .from("pass_subscriptions")
        .select("id, classes_used_this_period, studio_passes(max_classes_per_month)")
        .eq("member_id", memberId)
        .eq("status", "active")
        .gte("current_period_end", today);

      if (passSubs && passSubs.length > 0) {
        const sub = passSubs[0];
        const pass = unwrapRelation<{ max_classes_per_month: number | null }>(sub.studio_passes);
        const maxClasses = pass?.max_classes_per_month ?? null;
        const used = sub.classes_used_this_period ?? 0;
        const hasCapacity = maxClasses === null || used < maxClasses;

        passInfo = {
          hasPass: true,
          hasCapacity,
          classesUsed: used,
          maxClasses,
        };
      }
    }

    return NextResponse.json({
      sessions: formattedSessions,
      bookings: bookingsMap,
      confirmedCounts: confirmedMap,
      passInfo,
      memberCredits,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
