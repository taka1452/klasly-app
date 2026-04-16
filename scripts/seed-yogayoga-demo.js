/* eslint-disable no-console */
/**
 * Seed yogayoga demo accounts.
 *
 * Creates 1 manager, 10 instructors, and 10 members for the yogayoga studio
 * (identified by its owner's email).
 *
 * Usage:
 *   node scripts/seed-yogayoga-demo.js
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 *
 * Idempotent: if a demo email already exists it is skipped with a warning.
 */

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Minimal .env.local loader so the script works without extra dependencies.
function loadDotenvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadDotenvLocal();

const OWNER_EMAIL = "tybiz1452@gmail.com";
const DEFAULT_PASSWORD = "yogayoga-demo-2026";
const INSTRUCTOR_COUNT = 10;
const MEMBER_COUNT = 10;
const MANAGER_COUNT = 1;

// Fixed Japanese-ish names so the demo feels realistic and reruns are stable.
const INSTRUCTOR_NAMES = [
  "Akari Tanaka",
  "Yuki Sato",
  "Haruka Suzuki",
  "Ren Takahashi",
  "Sora Ito",
  "Mei Watanabe",
  "Riku Nakamura",
  "Aoi Kobayashi",
  "Hina Yamamoto",
  "Kaito Kato",
];

const MEMBER_NAMES = [
  "Emma Wilson",
  "Liam Brown",
  "Olivia Davis",
  "Noah Miller",
  "Ava Garcia",
  "Ethan Rodriguez",
  "Sophia Martinez",
  "Mason Lee",
  "Isabella Thompson",
  "Lucas Anderson",
];

const MANAGER_NAMES = ["Jordan Reed"];

const SPECIALTIES_POOL = [
  ["Vinyasa", "Power Yoga"],
  ["Hatha", "Restorative"],
  ["Yin Yoga", "Meditation"],
  ["Ashtanga", "Pranayama"],
  ["Prenatal Yoga"],
  ["Hot Yoga"],
  ["Aerial Yoga"],
  ["Iyengar"],
  ["Kundalini"],
  ["Gentle Flow", "Beginners"],
];

function env(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name} in .env.local`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Resolve the studio from the owner's email.
  const { data: ownerProfile, error: ownerErr } = await supabase
    .from("profiles")
    .select("id, studio_id, role, full_name")
    .eq("email", OWNER_EMAIL)
    .eq("role", "owner")
    .maybeSingle();

  if (ownerErr) {
    console.error("Failed to look up owner profile:", ownerErr.message);
    process.exit(1);
  }
  if (!ownerProfile || !ownerProfile.studio_id) {
    console.error(
      `No owner profile with studio_id found for ${OWNER_EMAIL}. ` +
        "Make sure the owner has completed onboarding."
    );
    process.exit(1);
  }

  const studioId = ownerProfile.studio_id;
  const { data: studio } = await supabase
    .from("studios")
    .select("id, name")
    .eq("id", studioId)
    .single();

  console.log(
    `Seeding demo accounts for studio "${studio?.name ?? studioId}" (${studioId})`
  );
  console.log(
    `Owner: ${ownerProfile.full_name ?? "—"} <${OWNER_EMAIL}> (${ownerProfile.id})`
  );
  console.log(
    `Default password for every demo account: ${DEFAULT_PASSWORD}\n`
  );

  const created = { managers: [], instructors: [], members: [] };

  // 2. Helpers --------------------------------------------------------------
  async function ensureAuthUser(email, fullName) {
    const emailNorm = email.trim().toLowerCase();
    const { data: createData, error: createErr } =
      await supabase.auth.admin.createUser({
        email: emailNorm,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          is_demo_account: true,
          default_password: DEFAULT_PASSWORD,
        },
      });

    if (!createErr && createData?.user) {
      return { id: createData.user.id, alreadyExisted: false };
    }

    const alreadyExists =
      createErr &&
      /already registered|already exists|already been registered/i.test(
        createErr.message
      );

    if (!alreadyExists) {
      throw new Error(`createUser failed for ${emailNorm}: ${createErr?.message}`);
    }

    // Already registered — find it.
    const { data: list } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const existing = list?.users?.find(
      (u) => (u.email ?? "").trim().toLowerCase() === emailNorm
    );
    if (!existing) {
      throw new Error(`Could not locate existing auth user for ${emailNorm}`);
    }
    return { id: existing.id, alreadyExisted: true };
  }

  async function upsertProfile(userId, email, fullName, role) {
    const { error } = await supabase.from("profiles").upsert(
      {
        id: userId,
        email,
        studio_id: studioId,
        role,
        full_name: fullName,
      },
      { onConflict: "id" }
    );
    if (error) throw new Error(`profiles upsert failed: ${error.message}`);
  }

  async function ensureInstructor(profileId, bio, specialties) {
    const { data: existing } = await supabase
      .from("instructors")
      .select("id")
      .eq("profile_id", profileId)
      .eq("studio_id", studioId)
      .maybeSingle();
    if (existing) return existing.id;

    const { data, error } = await supabase
      .from("instructors")
      .insert({ studio_id: studioId, profile_id: profileId, bio, specialties })
      .select("id")
      .single();
    if (error) throw new Error(`instructors insert failed: ${error.message}`);
    return data.id;
  }

  async function ensureMember(profileId) {
    const { data: existing } = await supabase
      .from("members")
      .select("id")
      .eq("profile_id", profileId)
      .eq("studio_id", studioId)
      .maybeSingle();
    if (existing) return existing.id;

    const { data, error } = await supabase
      .from("members")
      .insert({
        studio_id: studioId,
        profile_id: profileId,
        plan_type: "drop_in",
        status: "active",
      })
      .select("id")
      .single();
    if (error) throw new Error(`members insert failed: ${error.message}`);
    return data.id;
  }

  async function ensureManager(profileId) {
    const { data: existing } = await supabase
      .from("managers")
      .select("id")
      .eq("profile_id", profileId)
      .eq("studio_id", studioId)
      .maybeSingle();
    if (existing) return existing.id;

    const { data, error } = await supabase
      .from("managers")
      .insert({
        studio_id: studioId,
        profile_id: profileId,
        // Reasonable defaults for a studio manager
        can_manage_members: true,
        can_manage_classes: true,
        can_manage_instructors: true,
        can_manage_bookings: true,
        can_manage_rooms: true,
        can_view_payments: true,
        can_send_messages: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(`managers insert failed: ${error.message}`);
    return data.id;
  }

  // 3. Create manager(s) ---------------------------------------------------
  for (let i = 0; i < MANAGER_COUNT; i++) {
    const fullName = MANAGER_NAMES[i] ?? `Demo Manager ${i + 1}`;
    const email = `demo-manager-${i + 1}@yogayoga.demo`;
    try {
      const { id: uid, alreadyExisted } = await ensureAuthUser(email, fullName);
      await upsertProfile(uid, email, fullName, "manager");
      await ensureManager(uid);
      created.managers.push({ email, password: DEFAULT_PASSWORD, fullName, alreadyExisted });
      console.log(`  ✓ manager    ${email}${alreadyExisted ? " (reused)" : ""}`);
    } catch (err) {
      console.error(`  ✗ manager    ${email} — ${err.message}`);
    }
  }

  // 4. Create instructors --------------------------------------------------
  for (let i = 0; i < INSTRUCTOR_COUNT; i++) {
    const fullName = INSTRUCTOR_NAMES[i] ?? `Demo Instructor ${i + 1}`;
    const email = `demo-instructor-${i + 1}@yogayoga.demo`;
    const specialties = SPECIALTIES_POOL[i] ?? [];
    const bio = `${fullName} is a certified yoga instructor at yogayoga.`;
    try {
      const { id: uid, alreadyExisted } = await ensureAuthUser(email, fullName);
      await upsertProfile(uid, email, fullName, "instructor");
      await ensureInstructor(uid, bio, specialties);
      created.instructors.push({ email, password: DEFAULT_PASSWORD, fullName, alreadyExisted });
      console.log(`  ✓ instructor ${email}${alreadyExisted ? " (reused)" : ""}`);
    } catch (err) {
      console.error(`  ✗ instructor ${email} — ${err.message}`);
    }
  }

  // 5. Create members ------------------------------------------------------
  for (let i = 0; i < MEMBER_COUNT; i++) {
    const fullName = MEMBER_NAMES[i] ?? `Demo Member ${i + 1}`;
    const email = `demo-member-${i + 1}@yogayoga.demo`;
    try {
      const { id: uid, alreadyExisted } = await ensureAuthUser(email, fullName);
      await upsertProfile(uid, email, fullName, "member");
      await ensureMember(uid);
      created.members.push({ email, password: DEFAULT_PASSWORD, fullName, alreadyExisted });
      console.log(`  ✓ member     ${email}${alreadyExisted ? " (reused)" : ""}`);
    } catch (err) {
      console.error(`  ✗ member     ${email} — ${err.message}`);
    }
  }

  // 6. Summary -------------------------------------------------------------
  console.log("\n──── Summary ────");
  console.log(`Studio:      ${studio?.name ?? studioId}`);
  console.log(`Owner:       ${OWNER_EMAIL}`);
  console.log(`Managers:    ${created.managers.length}/${MANAGER_COUNT}`);
  console.log(`Instructors: ${created.instructors.length}/${INSTRUCTOR_COUNT}`);
  console.log(`Members:     ${created.members.length}/${MEMBER_COUNT}`);
  console.log(`Password:    ${DEFAULT_PASSWORD}`);
  console.log("\nAll demo emails use the @yogayoga.demo domain so they are easy to clean up later:");
  console.log(
    "  DELETE FROM auth.users WHERE email LIKE '%@yogayoga.demo';  -- cascades to profiles/etc."
  );
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
