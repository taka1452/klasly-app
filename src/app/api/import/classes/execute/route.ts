import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
import { NextResponse } from "next/server";

// ── Day-of-week normalization ────────────────────────────────────────────────
const DAY_ALIASES: Record<string, number> = {
  "0": 0, sun: 0, sunday: 0,
  "1": 1, mon: 1, monday: 1,
  "2": 2, tue: 2, tues: 2, tuesday: 2,
  "3": 3, wed: 3, wednesday: 3,
  "4": 4, thu: 4, thur: 4, thurs: 4, thursday: 4,
  "5": 5, fri: 5, friday: 5,
  "6": 6, sat: 6, saturday: 6,
};

function normalizeDayOfWeek(value: string): number | null {
  const key = value.trim().toLowerCase();
  const n = DAY_ALIASES[key];
  return n !== undefined ? n : null;
}

// ── Start-time normalization (HH:MM or H:MM → HH:MM:SS) ────────────────────
function normalizeStartTime(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

// ── Generate 4 weekly session dates starting from the next occurrence ────────
function generateSessionDates(dayOfWeek: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentDay = today.getDay();
  let daysUntilFirst = dayOfWeek - currentDay;
  if (daysUntilFirst < 0) daysUntilFirst += 7;

  const firstDate = new Date(today);
  firstDate.setDate(today.getDate() + daysUntilFirst);

  for (let i = 0; i < 4; i++) {
    const d = new Date(firstDate);
    d.setDate(firstDate.getDate() + i * 7);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

type RowResult = { row: number; name: string; reason: string };

export async function POST(request: Request) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    const { data: ownerProfile } = await adminSupabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    if (ownerProfile?.role === "manager") {
      const { data: mgr } = await adminSupabase
        .from("managers")
        .select("can_manage_classes")
        .eq("profile_id", user.id)
        .eq("studio_id", ownerProfile.studio_id)
        .single();
      if (!mgr?.can_manage_classes) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (ownerProfile?.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const studioId = ownerProfile.studio_id;
    if (!studioId) {
      return NextResponse.json({ error: "Studio not found. Complete onboarding first." }, { status: 400 });
    }

    // Fetch instructors for email → id lookup
    const { data: instructorRows } = await adminSupabase
      .from("instructors")
      .select("id, profiles(email)")
      .eq("studio_id", studioId);

    const instructorEmailMap = new Map<string, string>();
    for (const instr of instructorRows ?? []) {
      const prof = Array.isArray(instr.profiles) ? instr.profiles[0] : instr.profiles;
      const email = (prof as { email?: string | null })?.email;
      if (email) {
        instructorEmailMap.set(email.toLowerCase().trim(), instr.id);
      }
    }

    const body = await request.json();
    const { csvData, mapping = {} } = body as {
      csvData?: string;
      mapping?: Record<string, string>;
    };

    if (!csvData || typeof csvData !== "string") {
      return NextResponse.json({ error: "Missing csvData (base64)" }, { status: 400 });
    }

    let csvText: string;
    try {
      csvText = Buffer.from(csvData, "base64").toString("utf-8");
    } catch {
      return NextResponse.json({ error: "Invalid base64 csvData" }, { status: 400 });
    }

    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as Record<string, string>[];

    const columns = records.length > 0 ? Object.keys(records[0]) : [];
    const skipped: RowResult[] = [];
    const errors: RowResult[] = [];
    let imported = 0;

    const getCell = (row: Record<string, string>, col: string): string =>
      col && columns.includes(col) ? (row[col] ?? "").trim() : "";

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2;

      // ── Required fields ────────────────────────────────────────────────────
      const name = mapping.name ? getCell(row, mapping.name) : "";
      if (!name) {
        skipped.push({ row: rowNum, name: "(empty)", reason: "Class name is required" });
        continue;
      }

      const dayRaw = mapping.day_of_week ? getCell(row, mapping.day_of_week) : "";
      const dayOfWeek = normalizeDayOfWeek(dayRaw);
      if (dayOfWeek === null) {
        skipped.push({
          row: rowNum,
          name,
          reason: `Invalid day of week: "${dayRaw}" (use Monday, Tuesday…, or 0-6)`,
        });
        continue;
      }

      const timeRaw = mapping.start_time ? getCell(row, mapping.start_time) : "";
      const startTime = normalizeStartTime(timeRaw);
      if (!startTime) {
        skipped.push({
          row: rowNum,
          name,
          reason: `Invalid start time: "${timeRaw}" (use HH:MM format, e.g. 09:00)`,
        });
        continue;
      }

      const durationRaw = mapping.duration_minutes ? getCell(row, mapping.duration_minutes) : "";
      const duration = parseInt(durationRaw, 10);
      if (isNaN(duration) || duration < 1) {
        skipped.push({
          row: rowNum,
          name,
          reason: `Invalid duration: "${durationRaw}" (must be a positive integer)`,
        });
        continue;
      }

      const capacityRaw = mapping.capacity ? getCell(row, mapping.capacity) : "";
      const capacity = parseInt(capacityRaw, 10);
      if (isNaN(capacity) || capacity < 1) {
        skipped.push({
          row: rowNum,
          name,
          reason: `Invalid capacity: "${capacityRaw}" (must be a positive integer)`,
        });
        continue;
      }

      // ── Optional fields ────────────────────────────────────────────────────
      const description = mapping.description ? getCell(row, mapping.description) || null : null;
      const location = mapping.location ? getCell(row, mapping.location) || null : null;
      const instructorEmailRaw = mapping.instructor_email
        ? getCell(row, mapping.instructor_email)
        : "";
      const instructorId = instructorEmailRaw
        ? (instructorEmailMap.get(instructorEmailRaw.toLowerCase().trim()) ?? null)
        : null;

      // インストラクターメールが指定されたが見つからない場合、警告として記録
      if (instructorEmailRaw && !instructorId) {
        skipped.push({
          row: i + 1,
          name: getCell(row, mapping.name) || "",
          reason: `Instructor email "${instructorEmailRaw}" not found — class will be created without instructor`,
        });
      }

      // ── Insert class ───────────────────────────────────────────────────────
      const { data: newClass, error: classError } = await adminSupabase
        .from("classes")
        .insert({
          studio_id: studioId,
          instructor_id: instructorId,
          name,
          description,
          day_of_week: dayOfWeek,
          start_time: startTime,
          duration_minutes: duration,
          capacity,
          location,
          is_active: true,
        })
        .select("id")
        .single();

      if (classError || !newClass) {
        errors.push({ row: rowNum, name, reason: classError?.message ?? "Failed to create class" });
        continue;
      }

      // ── Generate 4 weekly sessions ─────────────────────────────────────────
      const sessionDates = generateSessionDates(dayOfWeek);
      const sessions = sessionDates.map((date) => ({
        studio_id: studioId,
        class_id: newClass.id,
        session_date: date,
        start_time: startTime,
        capacity,
        is_cancelled: false,
      }));

      const { error: sessionsError } = await adminSupabase
        .from("class_sessions")
        .insert(sessions);

      if (sessionsError) {
        console.error(`Sessions insert failed for row ${rowNum}:`, sessionsError.message);
        // Roll back the class since it has no sessions
        await adminSupabase.from("classes").delete().eq("id", newClass.id);
        errors.push({
          row: rowNum,
          name,
          reason: `Class created but session generation failed: ${sessionsError.message}. Class was rolled back.`,
        });
        continue;
      }

      imported++;
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: records.length,
        imported,
        skipped: skipped.length,
        errors: errors.length,
      },
      skipped,
      errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
