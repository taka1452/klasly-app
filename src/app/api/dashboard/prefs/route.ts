import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

interface DashboardPrefsPatch {
  setup_checklist_dismissed?: boolean;
}

function sanitize(raw: unknown): DashboardPrefsPatch | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  const out: DashboardPrefsPatch = {};
  if (typeof input.setup_checklist_dismissed === "boolean") {
    out.setup_checklist_dismissed = input.setup_checklist_dismissed;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const patch = sanitize(body);
  if (!patch) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = serviceKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
    : supabase;

  const { data: profile } = await admin
    .from("profiles")
    .select("dashboard_prefs")
    .eq("id", user.id)
    .single();

  const merged = {
    ...((profile?.dashboard_prefs as Record<string, unknown>) ?? {}),
    ...patch,
  };
  const { error } = await admin
    .from("profiles")
    .update({ dashboard_prefs: merged })
    .eq("id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
