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
 * アクティブなクラスに対してスタジオごとの設定週数分のセッションを自動生成する。
 * studios.session_generation_weeks の値を使用（デフォルト8週）。
 * 既存セッションがある日付はスキップするため冪等に実行できる。
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

    const { data: classes } = await supabase
      .from("classes")
      .select("id, studio_id, day_of_week, start_time, capacity, is_public, is_online, online_link")
      .eq("is_active", true)
      .eq("schedule_type", "recurring"); // Skip one-time classes

    if (!classes?.length) {
      try {
        if (cronLogId) {
          await adminDb
            .from("cron_logs")
            .update({
              status: "success",
              affected_count: 0,
              details: { classes_processed: 0 },
              completed_at: new Date().toISOString(),
            })
            .eq("id", cronLogId);
        }
      } catch {
        // ログ記録失敗はスキップ
      }
      return NextResponse.json({ processed: 0, created: 0 });
    }

    /**
     * Get "today" in a specific timezone as a YYYY-MM-DD string
     * and the corresponding day of week (0=Sun, 6=Sat).
     */
    const getTodayInTz = (tz: string): { dateStr: string; dayOfWeek: number } => {
      const now = new Date();
      // Format in the target timezone to get the local date components
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(now);
      const year = parts.find(p => p.type === "year")!.value;
      const month = parts.find(p => p.type === "month")!.value;
      const day = parts.find(p => p.type === "day")!.value;
      const dateStr = `${year}-${month}-${day}`;
      // Get day of week in the target timezone
      const weekdayStr = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        weekday: "short",
      }).format(now);
      const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      return { dateStr, dayOfWeek: dayMap[weekdayStr] ?? 0 };
    };

    let totalCreated = 0;

    for (const cls of classes) {
      // キャンセル済みスタジオのクラスはスキップ
      if (!studioWeeksMap.has(cls.studio_id)) continue;

      // スタジオごとの週数を取得（デフォルト8週）
      const weeksAhead = studioWeeksMap.get(cls.studio_id) ?? 8;
      const tz = studioTzMap.get(cls.studio_id) ?? "Asia/Tokyo";
      const { dateStr: todayStr, dayOfWeek: currentDay } = getTodayInTz(tz);

      // Parse today string to work with date arithmetic
      const [tYear, tMonth, tDay] = todayStr.split("-").map(Number);
      const today = new Date(tYear, tMonth - 1, tDay);
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + weeksAhead * 7);

      // このクラスが指定週数内に開催されるべき全日付を計算
      const expectedDates: string[] = [];
      let daysUntilFirst = (cls.day_of_week - currentDay + 7) % 7;

      const firstDate = new Date(today);
      firstDate.setDate(today.getDate() + daysUntilFirst);

      let d = new Date(firstDate);
      while (d <= targetDate) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        expectedDates.push(`${yyyy}-${mm}-${dd}`);
        d.setDate(d.getDate() + 7);
      }

      if (expectedDates.length === 0) continue;

      // 既存セッションを取得（重複挿入を防ぐ）
      const { data: existingSessions } = await supabase
        .from("class_sessions")
        .select("session_date")
        .eq("class_id", cls.id)
        .in("session_date", expectedDates);

      const existingDates = new Set(
        (existingSessions || []).map((s) => s.session_date)
      );

      // start_time を "HH:MM:SS" 形式に正規化
      const startTimeFormatted =
        typeof cls.start_time === "string" && cls.start_time.length >= 5
          ? cls.start_time.length === 5
            ? `${cls.start_time}:00`
            : cls.start_time
          : "00:00:00";

      const missingSessions = expectedDates
        .filter((date) => !existingDates.has(date))
        .map((date) => ({
          studio_id: cls.studio_id,
          class_id: cls.id,
          session_date: date,
          start_time: startTimeFormatted,
          capacity: cls.capacity,
          is_cancelled: false,
          is_public: cls.is_public ?? true,
          is_online: cls.is_online ?? false,
          online_link: cls.online_link ?? null,
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
            details: { classes_processed: classes.length, sessions_created: totalCreated },
            completed_at: new Date().toISOString(),
          })
          .eq("id", cronLogId);
      }
    } catch {
      // ログ記録失敗はスキップ
    }

    return NextResponse.json({
      processed: classes.length,
      created: totalCreated,
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
