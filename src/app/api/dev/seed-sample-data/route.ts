import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

/**
 * Idempotent sample-data seeder.
 *
 * Drops a small set of fake members and recurring classes into a studio so
 * the owner can poke around bookings, calendar, and member lists during
 * trial without having to invent data themselves. Designed to be cheap and
 * safe:
 *   - Members are created as profile-less rows (no auth users) tagged
 *     `[sample]` in `notes`.
 *   - Classes are created with `is_active=true` and a `[sample]` prefix in
 *     `description`.
 *   - Re-running the endpoint inserts only what's missing — existing
 *     real members/classes are never touched.
 *
 * Auth: owner OR manager with can_manage_settings.
 */

const SAMPLE_MEMBERS = [
  { full_name: "Alex Chen", email: "alex.chen@sample.klasly.app" },
  { full_name: "Maria Lopez", email: "maria.lopez@sample.klasly.app" },
  { full_name: "Jordan Kim", email: "jordan.kim@sample.klasly.app" },
  { full_name: "Riley Patel", email: "riley.patel@sample.klasly.app" },
  { full_name: "Sam Taylor", email: "sam.taylor@sample.klasly.app" },
];

const SAMPLE_CLASSES = [
  {
    name: "Morning Flow",
    description: "[sample] Gentle warm-up to start the day.",
    day_of_week: 1, // Monday
    start_time: "07:00:00",
    duration_minutes: 60,
    capacity: 12,
  },
  {
    name: "Evening Vinyasa",
    description: "[sample] A flowing 75-minute session for all levels.",
    day_of_week: 3, // Wednesday
    start_time: "18:30:00",
    duration_minutes: 75,
    capacity: 16,
  },
  {
    name: "Weekend Restorative",
    description: "[sample] Slow, supported poses to unwind.",
    day_of_week: 6, // Saturday
    start_time: "10:00:00",
    duration_minutes: 60,
    capacity: 10,
  },
];

const SAMPLE_NOTE = "[sample]";

async function getStudioContext() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) return null;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.studio_id) return null;

  if (profile.role === "owner") {
    return { supabase, studioId: profile.studio_id };
  }
  if (profile.role === "manager") {
    const { data: manager } = await supabase
      .from("managers")
      .select("can_manage_settings")
      .eq("profile_id", user.id)
      .eq("studio_id", profile.studio_id)
      .single();
    if (!manager?.can_manage_settings) return null;
    return { supabase, studioId: profile.studio_id };
  }
  return null;
}

export async function POST() {
  const ctx = await getStudioContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const created = { members: 0, classes: 0 };
  const errors: string[] = [];

  // ── Members ──────────────────────────────────────────
  for (const m of SAMPLE_MEMBERS) {
    try {
      // Profile-less member rows are unique by email on profiles, but we
      // keep them auth-userless so we'll dedupe on (studio_id, notes,
      // full-name-in-profile) using a profile we create ourselves.
      const { data: existingProfile } = await ctx.supabase
        .from("profiles")
        .select("id")
        .eq("email", m.email)
        .maybeSingle();

      let profileId: string | undefined = existingProfile?.id;
      if (!profileId) {
        // Migration 20240101000008 lets profiles exist without an auth user.
        const { data: newProfile, error: profileErr } = await ctx.supabase
          .from("profiles")
          .insert({
            studio_id: ctx.studioId,
            role: "member",
            full_name: m.full_name,
            email: m.email,
          })
          .select("id")
          .single();
        if (profileErr) throw profileErr;
        profileId = newProfile?.id;
      }

      if (!profileId) continue;

      const { data: existingMember } = await ctx.supabase
        .from("members")
        .select("id")
        .eq("studio_id", ctx.studioId)
        .eq("profile_id", profileId)
        .maybeSingle();

      if (!existingMember) {
        const { error: insertErr } = await ctx.supabase.from("members").insert({
          studio_id: ctx.studioId,
          profile_id: profileId,
          plan_type: "drop_in",
          status: "active",
          notes: SAMPLE_NOTE,
        });
        if (insertErr) throw insertErr;
        created.members += 1;
      }
    } catch (err) {
      errors.push(`member ${m.full_name}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  // ── Classes ──────────────────────────────────────────
  for (const c of SAMPLE_CLASSES) {
    try {
      const { data: existing } = await ctx.supabase
        .from("classes")
        .select("id")
        .eq("studio_id", ctx.studioId)
        .eq("name", c.name)
        .maybeSingle();

      if (!existing) {
        const { error: insertErr } = await ctx.supabase.from("classes").insert({
          studio_id: ctx.studioId,
          name: c.name,
          description: c.description,
          day_of_week: c.day_of_week,
          start_time: c.start_time,
          duration_minutes: c.duration_minutes,
          capacity: c.capacity,
          is_active: true,
          is_public: true,
        });
        if (insertErr) throw insertErr;
        created.classes += 1;
      }
    } catch (err) {
      errors.push(`class ${c.name}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return NextResponse.json({
    created,
    errors,
    success: errors.length === 0,
  });
}
