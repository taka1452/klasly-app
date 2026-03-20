import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * 週次繰り返しセッション（recurrence_rule = 'weekly'）を自動生成する。
 * recurrence_group_id ごとに最新のセッション日付を取得し、
 * studios.session_generation_weeks 分のセッションを先行生成する。
 * room_id がある場合は空き状況を確認してからインサートする。
 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );

  const cronStartedAt = new Date().toISOString();
  const adminDb = createAdminClient();
  let cronLogId: string | null = null;
  try {
    const { data: logRow } = await adminDb
      .from("cron_logs")
      .insert({
        job_name: "generate-sessions",
        status: "running",
        started_at: cronStartedAt,
      })
      .select("id")
      .single();
    cronLogId = logRow?.id ?? null;
  } catch {
    // ログ記録失敗はスキップ
  }

  try {
    // スタジオごとの session_generation_weeks + timezone を取得
    const { data: studios } = await supabase
      .from("studios")
      .select("id, session_generation_weeks, timezone, plan_status");

    const studioWeeksMap = new Map<string, number>();
    const studioTzMap = new Map<string, string>();
    for (const s of studios ?? []) {
      // キャンセル済みスタジオはスキップ
      if (s.plan_status === "canceled") continue;
      studioWeeksMap.set(s.id, s.session_generation_weeks ?? 8);
      studioTzMap.set(s.id, s.timezone ?? "Asia/Tokyo");
    }

    // Find all recurring sessions grouped by recurrence_group_id
    // We pick one representative session per group to use as the template
    const { data: rawRecurringSessions } = await supabase
      .from("class_sessions")
      .select("*")
      .eq("recurrence_rule", "weekly")
      .eq("is_cancelled", false)
      .not("recurrence_group_id", "is", null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recurringSessions = rawRecurringSessions as any[] | null;

    if (!recurringSessions?.length) {
      try {
        if (cronLogId) {
          await adminDb
            .from("cron_logs")
            .update({
              status: "success",
              affected_count: 0,
              details: { groups_processed: 0 },
              completed_at: new Date().toISOString(),
            })
            .eq("id", cronLogId);
        }
      } catch {
        // ログ記録失敗はスキップ
      }
      return NextResponse.json({ processed: 0, created: 0 });
    }

    // Group sessions by recurrence_group_id and find latest date + template row
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groupMap = new Map<string, { latestDate: string; template: any; studioId: string }>();

    for (const session of recurringSessions) {
      if (!session.recurrence_group_id) continue;
      const gid = session.recurrence_group_id as string;
      const existing = groupMap.get(gid);
      if (!existing || session.session_date > existing.latestDate) {
        groupMap.set(gid, {
          latestDate: session.session_date,
          template: session,
          studioId: session.studio_id,
        });
      }
    }

    /**
     * Get "today" in a specific timezone as a YYYY-MM-DD string.
     */
    const getTodayInTz = (tz: string): string => {
      const now = new Date();
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(now);
      const year = parts.find(p => p.type === "year")!.value;
      const month = parts.find(p => p.type === "month")!.value;
      const day = parts.find(p => p.type === "day")!.value;
      return `${year}-${month}-${day}`;
    };

    let totalCreated = 0;
    let groupsProcessed = 0;
    let roomConflicts = 0;

    const groupEntries = Array.from(groupMap.entries());
    for (const [groupId, group] of groupEntries) {
      const { latestDate, template: src, studioId } = group;

      // キャンセル済みスタジオはスキップ
      if (!studioWeeksMap.has(studioId)) continue;

      const weeksAhead = studioWeeksMap.get(studioId) ?? 8;
      const tz = studioTzMap.get(studioId) ?? "Asia/Tokyo";
      const todayStr = getTodayInTz(tz);

      // Parse latest date and calculate target date
      const [lYear, lMonth, lDay] = latestDate.split("-").map(Number);
      const latestDateObj = new Date(lYear, lMonth - 1, lDay);

      // Parse today
      const [tYear, tMonth, tDay] = todayStr.split("-").map(Number);
      const todayObj = new Date(tYear, tMonth - 1, tDay);

      // Target date = today + weeksAhead * 7
      const targetDate = new Date(todayObj);
      targetDate.setDate(todayObj.getDate() + weeksAhead * 7);

      // Generate weekly dates starting from latestDate + 7 days
      const expectedDates: string[] = [];
      const nextDate = new Date(latestDateObj);
      nextDate.setDate(latestDateObj.getDate() + 7);

      while (nextDate <= targetDate) {
        const yyyy = nextDate.getFullYear();
        const mm = String(nextDate.getMonth() + 1).padStart(2, "0");
        const dd = String(nextDate.getDate()).padStart(2, "0");
        expectedDates.push(`${yyyy}-${mm}-${dd}`);
        nextDate.setDate(nextDate.getDate() + 7);
      }

      if (expectedDates.length === 0) continue;
      groupsProcessed++;

      // Check existing sessions for this group to avoid duplicates
      const { data: existingSessions } = await supabase
        .from("class_sessions")
        .select("session_date")
        .eq("recurrence_group_id", groupId)
        .in("session_date", expectedDates);

      const existingDates = new Set(
        (existingSessions || []).map((s) => s.session_date)
      );

      // Filter out existing dates
      let missingDates = expectedDates.filter((date) => !existingDates.has(date));

      if (missingDates.length === 0) continue;

      // Normalize start_time to "HH:MM:SS" format
      const startTimeFormatted =
        typeof src.start_time === "string" && src.start_time.length >= 5
          ? src.start_time.length === 5
            ? `${src.start_time}:00`
            : src.start_time
          : "00:00:00";

      const endTimeFormatted =
        typeof src.end_time === "string" && src.end_time.length >= 5
          ? src.end_time.length === 5
            ? `${src.end_time}:00`
            : src.end_time
          : null;

      // Room conflict check: if session has a room, verify availability
      if (src.room_id) {
        const availableDates: string[] = [];
        for (const date of missingDates) {
          const { data: conflicts } = await supabase
            .from("class_sessions")
            .select("id")
            .eq("room_id", src.room_id)
            .eq("session_date", date)
            .eq("is_cancelled", false)
            .lt("start_time", endTimeFormatted || startTimeFormatted)
            .gt("end_time", startTimeFormatted);

          if (conflicts && conflicts.length > 0) {
            roomConflicts++;
            continue;
          }
          availableDates.push(date);
        }
        missingDates = availableDates;
      }

      if (missingDates.length === 0) continue;

      const missingSessions = missingDates.map((date) => ({
        studio_id: studioId,
        template_id: src.template_id ?? null,
        room_id: src.room_id ?? null,
        instructor_id: src.instructor_id ?? null,
        session_type: src.session_type ?? "class",
        session_date: date,
        start_time: startTimeFormatted,
        end_time: endTimeFormatted,
        duration_minutes: src.duration_minutes ?? null,
        capacity: src.capacity,
        is_public: src.is_public ?? true,
        is_cancelled: false,
        price_cents: src.price_cents ?? null,
        location: src.location ?? null,
        title: src.title ?? null,
        online_link: src.online_link ?? null,
        recurrence_group_id: groupId,
        recurrence_rule: "weekly" as const,
      }));

      if (missingSessions.length > 0) {
        const { error } = await supabase
          .from("class_sessions")
          .insert(missingSessions);
        if (!error) {
          totalCreated += missingSessions.length;
        }
      }
    }

    try {
      if (cronLogId) {
        const adminDb = createAdminClient();
        await adminDb
          .from("cron_logs")
          .update({
            status: "success",
            affected_count: totalCreated,
            details: {
              groups_processed: groupsProcessed,
              sessions_created: totalCreated,
              room_conflicts_skipped: roomConflicts,
            },
            completed_at: new Date().toISOString(),
          })
          .eq("id", cronLogId);
      }
    } catch {
      // ログ記録失敗はスキップ
    }

    return NextResponse.json({
      processed: groupsProcessed,
      created: totalCreated,
      room_conflicts_skipped: roomConflicts,
    });
  } catch (error) {
    try {
      if (cronLogId) {
        const adminDb = createAdminClient();
        await adminDb
          .from("cron_logs")
          .update({
            status: "failure",
            error_message: error instanceof Error ? error.message : "Unknown error",
            completed_at: new Date().toISOString(),
          })
          .eq("id", cronLogId);
      }
    } catch {
      // ログ記録失敗はスキップ
    }
    throw error;
  }
}
