import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/members-search?q=...
 *
 * Lightweight typeahead for owners/managers — returns up to 20 active members
 * in the actor's studio matching the query, with each member's most-relevant
 * active pass (if any) so the caller can show "12/14 sessions used" hints.
 */
export async function GET(request: NextRequest) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = serviceRoleKey
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
      : serverSupabase;

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();
    if (!profile?.studio_id) {
      return NextResponse.json({ members: [] });
    }
    if (profile.role !== "owner" && profile.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const q = (request.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();

    const { data: members } = await supabase
      .from("members")
      .select("id, credits, profiles(full_name, email)")
      .eq("studio_id", profile.studio_id)
      .eq("status", "active");

    type ProfileLite = { full_name?: string; email?: string };
    const filtered = (members ?? []).filter((m) => {
      if (!q) return true;
      const p = Array.isArray(m.profiles)
        ? (m.profiles[0] as ProfileLite | undefined)
        : (m.profiles as ProfileLite | null);
      const name = (p?.full_name ?? "").toLowerCase();
      const email = (p?.email ?? "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });

    const slice = filtered.slice(0, 20);
    const ids = slice.map((m) => m.id);

    let passByMember: Record<
      string,
      { subscriptionId: string; used: number; max: number | null }
    > = {};
    if (ids.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: passSubs } = await supabase
        .from("pass_subscriptions")
        .select(
          "id, member_id, classes_used_this_period, current_period_end, studio_passes(max_classes_per_month)"
        )
        .in("member_id", ids)
        .eq("status", "active")
        .gte("current_period_end", today);

      type SP = { max_classes_per_month: number | null };
      for (const sub of passSubs ?? []) {
        if (passByMember[sub.member_id]) continue;
        const sp = Array.isArray(sub.studio_passes)
          ? (sub.studio_passes[0] as SP | undefined)
          : (sub.studio_passes as SP | null);
        passByMember[sub.member_id] = {
          subscriptionId: sub.id,
          used: sub.classes_used_this_period ?? 0,
          max: sp?.max_classes_per_month ?? null,
        };
      }
    }

    const result = slice.map((m) => {
      const p = Array.isArray(m.profiles)
        ? (m.profiles[0] as ProfileLite | undefined)
        : (m.profiles as ProfileLite | null);
      return {
        id: m.id,
        full_name: p?.full_name ?? "—",
        email: p?.email ?? "",
        credits: m.credits ?? 0,
        active_pass: passByMember[m.id] ?? null,
      };
    });

    return NextResponse.json({ members: result });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
