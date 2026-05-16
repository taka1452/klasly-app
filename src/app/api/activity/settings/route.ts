import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_ALERT_THRESHOLDS,
  DEFAULT_DISPLAY_PREFS,
} from "@/lib/activity/defaults";
import type {
  AlertThresholds,
  DisplayPrefs,
} from "@/lib/activity/types";

function sanitizeThresholds(
  raw: unknown,
): Partial<AlertThresholds> | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  const out: Partial<AlertThresholds> = {};
  for (const key of Object.keys(DEFAULT_ALERT_THRESHOLDS) as (keyof AlertThresholds)[]) {
    const v = input[key];
    // tier_limit_warning_pct is a percentage (0-100); everything else is days/count (0-365).
    const max = key === "tier_limit_warning_pct" ? 100 : 365;
    if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max) {
      out[key] = Math.floor(v);
    }
  }
  return out;
}

function sanitizeDisplayPrefs(
  raw: unknown,
): Partial<DisplayPrefs> | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  const out: Partial<DisplayPrefs> = {};
  if (typeof input.hide_read === "boolean") out.hide_read = input.hide_read;
  if (
    typeof input.default_tab === "string" &&
    [
      "all",
      "booking",
      "billing",
      "operations",
      "member",
      "announcement",
      "alert",
    ].includes(input.default_tab)
  ) {
    out.default_tab = input.default_tab as DisplayPrefs["default_tab"];
  }
  return out;
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
  const thresholdsPatch = sanitizeThresholds(body.thresholds);
  const displayPrefsPatch = sanitizeDisplayPrefs(body.displayPrefs);

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = serviceKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
    : supabase;

  const { data: profile } = await admin
    .from("profiles")
    .select("id, studio_id, role, activity_feed_prefs")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id) {
    return NextResponse.json({ error: "No studio" }, { status: 400 });
  }

  // Persist display prefs for the current user.
  if (displayPrefsPatch) {
    const merged = {
      ...(DEFAULT_DISPLAY_PREFS as unknown as Record<string, unknown>),
      ...((profile.activity_feed_prefs as Record<string, unknown>) ?? {}),
      ...displayPrefsPatch,
    };
    const { error } = await admin
      .from("profiles")
      .update({ activity_feed_prefs: merged })
      .eq("id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Persist thresholds for owner / manager(settings) only.
  if (thresholdsPatch) {
    let canEdit = profile.role === "owner";
    if (!canEdit && profile.role === "manager") {
      const { data: mgr } = await admin
        .from("managers")
        .select("can_manage_settings")
        .eq("profile_id", user.id)
        .eq("studio_id", profile.studio_id)
        .single();
      canEdit = mgr?.can_manage_settings === true;
    }
    if (!canEdit) {
      return NextResponse.json(
        { error: "Forbidden: cannot edit alert thresholds" },
        { status: 403 },
      );
    }

    const { data: studio } = await admin
      .from("studios")
      .select("activity_feed_settings")
      .eq("id", profile.studio_id)
      .single();

    const merged = {
      ...(DEFAULT_ALERT_THRESHOLDS as unknown as Record<string, unknown>),
      ...((studio?.activity_feed_settings as Record<string, unknown>) ?? {}),
      ...thresholdsPatch,
    };
    const { error } = await admin
      .from("studios")
      .update({ activity_feed_settings: merged })
      .eq("id", profile.studio_id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
