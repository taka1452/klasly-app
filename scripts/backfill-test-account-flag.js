/* eslint-disable no-console */
/**
 * Backfill user_metadata.is_test_account = true for every existing account
 * whose email matches one of the seeded demo / test patterns. Idempotent.
 *
 * Intended for one-off use after deploying the Test Account Switcher so
 * that studios seeded before the flag was added can still use the feature.
 *
 *   node scripts/backfill-test-account-flag.js
 */

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

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
    if (value.startsWith("=")) value = value.slice(1);
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadDotenvLocal();

const MATCH_EMAIL = (email) => {
  const e = email.toLowerCase();
  return (
    e.endsWith("@yogayoga.demo") ||
    /^test-instructor-[a-z0-9]+@klasly\.app$/.test(e) ||
    /^test-member-[a-z0-9]+@klasly\.app$/.test(e)
  );
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let page = 1;
  let total = 0;
  let patched = 0;
  const seen = new Set();
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) {
      console.error("listUsers failed:", error.message);
      process.exit(1);
    }
    const users = data?.users ?? [];
    if (users.length === 0) break;
    for (const u of users) {
      if (seen.has(u.id)) continue;
      seen.add(u.id);
      total += 1;
      const email = u.email || "";
      if (!MATCH_EMAIL(email)) continue;
      if (u.user_metadata?.is_test_account === true) continue;
      const { error: upErr } = await supabase.auth.admin.updateUserById(u.id, {
        user_metadata: {
          ...(u.user_metadata || {}),
          is_test_account: true,
        },
      });
      if (upErr) {
        console.warn(`  ✗ ${email} — ${upErr.message}`);
        continue;
      }
      patched += 1;
      console.log(`  ✓ ${email}`);
    }
    if (users.length < 1000) break;
    page += 1;
  }
  console.log(`\nScanned ${total} users, flagged ${patched}.`);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
