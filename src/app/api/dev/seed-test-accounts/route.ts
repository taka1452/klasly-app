import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

/**
 * Idempotent test-account seeder.
 *
 * Onboarding (/api/onboarding/create-studio) auto-creates a test instructor
 * and test member when a studio is first created, but the call is
 * fire-and-forget — if it silently fails (transient API hiccup, partial
 * outage), the studio ends up with no test accounts and there's no UI to
 * recover. This endpoint lets owners (and managers with can_manage_settings)
 * re-run that seed safely from the Test Accounts card. Existing test
 * accounts in the studio are left untouched; missing ones are created.
 *
 * Auth: owner OR manager with can_manage_settings.
 */

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

  const shortId = ctx.studioId.replace(/-/g, "").slice(0, 8);
  const defaultPassword = "klasly-test-2024";

  const created: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  // --- Test instructor ---
  try {
    const email = `test-instructor-${shortId}@klasly.app`;
    const { data: existing } = await ctx.supabase
      .from("profiles")
      .select("id, role")
      .eq("email", email)
      .maybeSingle();

    if (existing?.id) {
      skipped.push("instructor");
    } else {
      const { data: authUser, error: authErr } = await ctx.supabase.auth.admin.createUser({
        email,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: {
          full_name: "Test Instructor",
          is_test_account: true,
          default_password: defaultPassword,
        },
      });
      if (authErr) throw authErr;
      if (authUser?.user) {
        await ctx.supabase.from("profiles").upsert(
          {
            id: authUser.user.id,
            studio_id: ctx.studioId,
            role: "instructor",
            full_name: "Test Instructor",
            email,
          },
          { onConflict: "id" }
        );

        const { data: existingInstr } = await ctx.supabase
          .from("instructors")
          .select("id")
          .eq("profile_id", authUser.user.id)
          .eq("studio_id", ctx.studioId)
          .maybeSingle();
        if (!existingInstr) {
          await ctx.supabase.from("instructors").insert({
            studio_id: ctx.studioId,
            profile_id: authUser.user.id,
            bio: "This is a test account for previewing the instructor experience.",
          });
        }
        created.push("instructor");
      }
    }
  } catch (err) {
    errors.push(`instructor: ${err instanceof Error ? err.message : "unknown"}`);
  }

  // --- Test member ---
  try {
    const email = `test-member-${shortId}@klasly.app`;
    const { data: existing } = await ctx.supabase
      .from("profiles")
      .select("id, role")
      .eq("email", email)
      .maybeSingle();

    if (existing?.id) {
      skipped.push("member");
    } else {
      const { data: authUser, error: authErr } = await ctx.supabase.auth.admin.createUser({
        email,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: {
          full_name: "Test Member",
          is_test_account: true,
          default_password: defaultPassword,
        },
      });
      if (authErr) throw authErr;
      if (authUser?.user) {
        await ctx.supabase.from("profiles").upsert(
          {
            id: authUser.user.id,
            studio_id: ctx.studioId,
            role: "member",
            full_name: "Test Member",
            email,
          },
          { onConflict: "id" }
        );
        const { data: existingMember } = await ctx.supabase
          .from("members")
          .select("id")
          .eq("profile_id", authUser.user.id)
          .eq("studio_id", ctx.studioId)
          .maybeSingle();
        if (!existingMember) {
          await ctx.supabase.from("members").insert({
            studio_id: ctx.studioId,
            profile_id: authUser.user.id,
            plan_type: "drop_in",
            status: "active",
          });
        }
        created.push("member");
      }
    }
  } catch (err) {
    errors.push(`member: ${err instanceof Error ? err.message : "unknown"}`);
  }

  return NextResponse.json({
    created,
    skipped,
    errors,
    success: errors.length === 0,
  });
}
