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
  if (ctx.role === "manager" && !ctx.permissions?.can_manage_instructors) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = ctx.supabase;

  const { data: rows } = await supabase
    .from("instructors")
    .select("bio, specialties, profiles(full_name, email, phone)")
    .eq("studio_id", ctx.studioId)
    .order("created_at", { ascending: false });

  const headers = ["Name", "Email", "Phone", "Bio", "Specialties"];
  const lines: string[] = [headers.map(escapeCsvCell).join(",")];

  for (const instr of rows ?? []) {
    const p = (instr as { profiles?: { full_name?: string; email?: string; phone?: string } }).profiles;
    const prof = Array.isArray(p) ? p[0] : p;
    const specialties = Array.isArray(instr.specialties) ? instr.specialties.join(", ") : (instr.specialties ?? "");
    lines.push(
      [
        prof?.full_name ?? "",
        prof?.email ?? "",
        prof?.phone ?? "",
        instr.bio ?? "",
        specialties,
      ]
        .map(escapeCsvCell)
        .join(",")
    );
  }

  const csv = lines.join("\n");
  const filename = "instructors-" + new Date().toISOString().slice(0, 10) + ".csv";
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
