import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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
  const { data: profile } = await supabase.from("profiles").select("studio_id, role").eq("id", user.id).single();
  if (!profile?.studio_id || profile.role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data: rows } = await supabase.from("members").select("*, profiles(full_name, email, phone)").eq("studio_id", profile.studio_id).order("joined_at", { ascending: false });
  const headers = ["Name", "Email", "Phone", "Plan Type", "Credits", "Status", "Waiver Signed", "Joined At"];
  const lines: string[] = [headers.map(escapeCsvCell).join(",")];
  for (const m of rows ?? []) {
    const p = (m as { profiles?: { full_name?: string; email?: string; phone?: string } }).profiles;
    const prof = Array.isArray(p) ? p[0] : p;
    const joined = m.joined_at ? new Date(m.joined_at).toISOString().slice(0, 10) : "";
    lines.push([prof?.full_name ?? "", prof?.email ?? "", prof?.phone ?? "", m.plan_type ?? "", m.credits ?? 0, m.status ?? "", m.waiver_signed ? "Yes" : "No", joined].map(escapeCsvCell).join(","));
  }
  const csv = lines.join("\n");
  const filename = "members-" + new Date().toISOString().slice(0, 10) + ".csv";
  return new NextResponse(csv, { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=\"" + filename + "\"" } });
}
