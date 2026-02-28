import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: Request) {
  const serverSupabase = await createServerClient();
  const { data: { user } } = await serverSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
  const { data: profile } = await supabase.from("profiles").select("studio_id, role").eq("id", user.id).single();
  if (!profile?.studio_id || profile.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const toParam = searchParams.get("to");
  const fromParam = searchParams.get("from");
  const now = new Date();
  const defaultTo = now.toISOString().slice(0, 10);
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const from = fromParam || defaultFrom;
  const to = toParam || defaultTo;
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, status, attended, credit_deducted, created_at, members(id, profiles(full_name, email)), class_sessions(id, session_date, start_time, classes(name))")
    .eq("studio_id", profile.studio_id)
    .gte("created_at", from + "T00:00:00.000Z")
    .lte("created_at", to + "T23:59:59.999Z")
    .order("created_at", { ascending: false });
  const headers = ["Date", "Class Name", "Member Name", "Member Email", "Status", "Attended", "Credit Deducted"];
  const lines: string[] = [headers.map(escapeCsvCell).join(",")];
  for (const b of bookings ?? []) {
    const sess = (b as { class_sessions?: { session_date?: string; classes?: { name?: string } } }).class_sessions;
    const session = Array.isArray(sess) ? sess[0] : sess;
    const cls = session?.classes;
    const className = Array.isArray(cls) ? cls[0]?.name : (cls as { name?: string })?.name;
    const mem = (b as { members?: { profiles?: { full_name?: string; email?: string } } }).members;
    const member = Array.isArray(mem) ? mem[0] : mem;
    const prof = member?.profiles;
    const profileData = Array.isArray(prof) ? prof[0] : prof;
    const sessionDate = session?.session_date ?? "";
    const dateStr = sessionDate ? new Date(sessionDate).toISOString().slice(0, 10) : "";
    lines.push([
      dateStr,
      className ?? "",
      profileData?.full_name ?? "",
      profileData?.email ?? "",
      b.status ?? "",
      b.attended ? "Yes" : "No",
      b.credit_deducted ? "Yes" : "No",
    ].map(escapeCsvCell).join(","));
  }
  const csv = lines.join("\n");
  const filename = "bookings-" + from + "-to-" + to + ".csv";
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"" + filename + "\"",
    },
  });
}
