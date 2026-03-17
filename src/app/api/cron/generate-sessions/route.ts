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
 * アクティブなクラスに対して今後8週分のセッションを自動生成する。
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
  let cronLogId: string | null = null;
  try {
    const adminDb = createAdminClient();
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
    const { data: classes } = await supabase
      .from("classes")
      .select("id, studio_id, day_of_week, start_time, capacity, is_public, is_online, online_link")
      .eq("is_active", true);

    if (!classes?.length) {
      try {
        if (cronLogId) {
          const adminDb = createAdminClient();
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

    // 今日〜8週後の日付範囲
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + 56); // 8週 = 56日

    let totalCreated = 0;

    for (const cls of classes) {
      // このクラスが今後8週内に開催されるべき全日付を計算
      const expectedDates: string[] = [];
      const currentDay = today.getDay();
      let daysUntilFirst = (cls.day_of_week - currentDay + 7) % 7;

      const firstDate = new Date(today);
      firstDate.setDate(today.getDate() + daysUntilFirst);

      let d = new Date(firstDate);
      while (d <= targetDate) {
        expectedDates.push(d.toISOString().split("T")[0]);
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
