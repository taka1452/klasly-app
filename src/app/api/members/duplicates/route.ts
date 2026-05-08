import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/auth/dashboard-access";

export async function GET() {
  const ctx = await getDashboardContext();
  if (!ctx) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (ctx.role === "manager" && !ctx.permissions?.can_manage_members) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: members, error } = await ctx.supabase
    .from("members")
    .select("id, profile_id, status, profiles(full_name, email, phone)")
    .eq("studio_id", ctx.studioId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Row = {
    id: string;
    profile_id: string;
    status: string;
    profiles: { full_name: string; email: string; phone: string | null } | null;
  };

  const rows: Row[] = ((members ?? []) as unknown as Record<string, unknown>[]).map((m) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] ?? null : m.profiles ?? null;
    return {
      id: m.id as string,
      profile_id: m.profile_id as string,
      status: m.status as string,
      profiles: p as Row["profiles"],
    };
  });

  // Group by email (exact match, case-insensitive)
  const byEmail: Record<string, Row[]> = {};
  for (const m of rows) {
    const email = m.profiles?.email?.toLowerCase();
    if (!email) continue;
    (byEmail[email] ??= []).push(m);
  }

  // Group by phone (normalized digits only)
  const byPhone: Record<string, Row[]> = {};
  for (const m of rows) {
    const phone = m.profiles?.phone?.replace(/\D/g, "");
    if (!phone || phone.length < 7) continue;
    const key = phone.slice(-10);
    (byPhone[key] ??= []).push(m);
  }

  // Group by normalized name
  const byName: Record<string, Row[]> = {};
  for (const m of rows) {
    const name = m.profiles?.full_name?.trim().toLowerCase().replace(/\s+/g, " ");
    if (!name) continue;
    (byName[name] ??= []).push(m);
  }

  type DuplicateGroup = {
    matchType: "email" | "phone" | "name";
    matchValue: string;
    members: {
      id: string;
      name: string;
      email: string;
      phone: string | null;
      status: string;
    }[];
  };

  const groups: DuplicateGroup[] = [];
  const seen = new Set<string>();

  function toMembers(ms: Row[]) {
    return ms.map((m) => ({
      id: m.id,
      name: m.profiles?.full_name ?? "",
      email: m.profiles?.email ?? "",
      phone: m.profiles?.phone ?? null,
      status: m.status,
    }));
  }

  for (const email of Object.keys(byEmail)) {
    const ms = byEmail[email];
    if (ms.length < 2) continue;
    const key = ms.map((m) => m.id).sort().join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    groups.push({ matchType: "email", matchValue: email, members: toMembers(ms) });
  }

  for (const phone of Object.keys(byPhone)) {
    const ms = byPhone[phone];
    if (ms.length < 2) continue;
    const key = ms.map((m) => m.id).sort().join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    groups.push({ matchType: "phone", matchValue: phone, members: toMembers(ms) });
  }

  for (const name of Object.keys(byName)) {
    const ms = byName[name];
    if (ms.length < 2) continue;
    const key = ms.map((m) => m.id).sort().join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    groups.push({ matchType: "name", matchValue: name, members: toMembers(ms) });
  }

  return NextResponse.json({ groups });
}
