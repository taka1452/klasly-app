import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/auth/dashboard-access";

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const ctx = await getDashboardContext();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (ctx.role === "manager" && !ctx.permissions?.can_manage_members) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const supabase = ctx.supabase;
  const { data: rows } = await supabase.from("members").select("*, profiles(full_name, email, phone)").eq("studio_id", ctx.studioId).order("joined_at", { ascending: false });
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
