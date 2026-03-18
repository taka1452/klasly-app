import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/auth/dashboard-access";

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: Request) {
  const ctx = await getDashboardContext();
  if (!ctx) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (ctx.role === "manager" && !ctx.permissions?.can_view_payments) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = ctx.supabase;

  const { searchParams } = new URL(request.url);
  const toParam = searchParams.get("to");
  const fromParam = searchParams.get("from");
  const now = new Date();
  const defaultTo = now.toISOString().slice(0, 10);
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const from = fromParam || defaultFrom;
  const to = toParam || defaultTo;

  const { data: payments } = await supabase
    .from("payments")
    .select(
      `
      id,
      amount,
      currency,
      type,
      status,
      payment_type,
      description,
      paid_at,
      created_at,
      member_id,
      members (
        id,
        profiles (full_name, email)
      )
    `
    )
    .eq("studio_id", ctx.studioId)
    .gte("created_at", `${from}T00:00:00.000Z`)
    .lte("created_at", `${to}T23:59:59.999Z`)
    .order("created_at", { ascending: false });

  const headers = [
    "Date",
    "Member Name",
    "Member Email",
    "Amount",
    "Currency",
    "Type",
    "Status",
    "Description",
  ];
  const lines: string[] = [headers.map(escapeCsvCell).join(",")];

  const typeLabel = (pt: string | undefined, t: string): string => {
    const p = pt ?? t;
    if (p === "subscription") return "Studio plan";
    if (p === "monthly") return "Monthly";
    if (p === "pack_5") return "5-Pack";
    if (p === "pack_10") return "10-Pack";
    if (p === "drop_in") return "Drop-in";
    return p;
  };

  for (const p of payments ?? []) {
    const mem = (p as { members?: { profiles?: { full_name?: string; email?: string } } }).members;
    const member = Array.isArray(mem) ? mem[0] : mem;
    const prof = member?.profiles;
    const profileData = Array.isArray(prof) ? prof[0] : prof;
    const amountDollars = (p.amount ?? 0) / 100;
    const dateVal = p.paid_at ?? p.created_at ?? "";
    const dateStr = dateVal ? new Date(dateVal).toISOString().slice(0, 10) : "";

    lines.push(
      [
        dateStr,
        profileData?.full_name ?? "",
        profileData?.email ?? "",
        amountDollars.toFixed(2),
        p.currency ?? "usd",
        typeLabel((p as { payment_type?: string }).payment_type, p.type ?? ""),
        p.status ?? "",
        (p as { description?: string | null }).description ?? "",
      ].map(escapeCsvCell).join(",")
    );
  }

  const csv = lines.join("\n");
  const filename = `payments-${from}-to-${to}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
