import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const serverSupabase = await createServerClient();
  const { data: { user } } = await serverSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return NextResponse.json({ error: "Server configuration error" }, { status: 500 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id || profile.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: rows } = await supabase
    .from("classes")
    .select("name, day_of_week, start_time, duration_minutes, capacity, description, location, instructors(profiles(email))")
    .eq("studio_id", profile.studio_id)
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
