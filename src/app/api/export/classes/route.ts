import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/auth/dashboard-access";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const ctx = await getDashboardContext();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (ctx.role === "manager" && !ctx.permissions?.can_manage_classes) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = ctx.supabase;

  const { data: rows } = await supabase
    .from("classes")
    .select("name, day_of_week, start_time, duration_minutes, capacity, description, location, instructors(profiles(email))")
    .eq("studio_id", ctx.studioId)
    .eq("is_active", true)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  const headers = ["Name", "Day of Week", "Start Time", "Duration (minutes)", "Capacity", "Description", "Location", "Instructor Email"];
  const lines: string[] = [headers.map(escapeCsvCell).join(",")];

  for (const cls of rows ?? []) {
    const day = DAYS[cls.day_of_week as number] ?? String(cls.day_of_week);
    // Format start_time: "09:00:00" → "09:00"
    const startTime = typeof cls.start_time === "string" ? cls.start_time.slice(0, 5) : "";

    const instrData = (cls as { instructors?: { profiles?: { email?: string | null } | Array<{ email?: string | null }> } | null }).instructors;
    const instrProfiles = instrData
      ? Array.isArray(instrData)
        ? instrData[0]?.profiles
        : instrData.profiles
      : null;
    const instrEmail = instrProfiles
      ? Array.isArray(instrProfiles)
        ? (instrProfiles[0]?.email ?? "")
        : (instrProfiles.email ?? "")
      : "";

    lines.push(
      [
        cls.name ?? "",
        day,
        startTime,
        cls.duration_minutes ?? "",
        cls.capacity ?? "",
        cls.description ?? "",
        cls.location ?? "",
        instrEmail,
      ]
        .map(escapeCsvCell)
        .join(",")
    );
  }

  const csv = lines.join("\n");
  const filename = "classes-" + new Date().toISOString().slice(0, 10) + ".csv";
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
