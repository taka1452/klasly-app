/* eslint-disable no-console */
/**
 * One-off: cancel a studio's current Stripe subscription and create a new one
 * with a specified trial_end. Used when a refund was issued but the existing
 * subscription's current_period_end is locked to the original billing cycle,
 * so trial_end alone doesn't move the next charge.
 *
 * Order matters:
 *   1. Create new sub on same customer (metadata.studio_id set)
 *   2. Swap studios.stripe_subscription_id to the new one
 *   3. Cancel old sub (webhook for deletion can't find the studio anymore,
 *      so plan_status is preserved)
 *
 * Required env (reads .env.local):
 *   STRIPE_SECRET_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/swap-subscription.js \
 *     --studio-id=<uuid> \
 *     --old-sub=<sub_xxx> \
 *     --price=<price_xxx> \
 *     --trial-end=2026-05-12 \
 *     [--dry-run]
 */

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const Stripe = require("stripe");

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

function parseArgs() {
  const args = {};
  for (const raw of process.argv.slice(2)) {
    if (!raw.startsWith("--")) continue;
    const [k, v] = raw.slice(2).split("=");
    args[k] = v === undefined ? true : v;
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const studioId = args["studio-id"];
  const oldSubId = args["old-sub"];
  const priceId = args["price"];
  const trialEndStr = args["trial-end"];
  const dryRun = !!args["dry-run"];

  if (!studioId || !oldSubId || !priceId || !trialEndStr) {
    console.error(
      "Missing required args. Need --studio-id, --old-sub, --price, --trial-end=YYYY-MM-DD"
    );
    process.exit(1);
  }

  // Use noon UTC so the date reads as "May 12" in both JST (21:00) and PDT (05:00)
  const trialEndDate = new Date(`${trialEndStr}T12:00:00Z`);
  if (Number.isNaN(trialEndDate.getTime())) {
    console.error(`Invalid --trial-end: ${trialEndStr}`);
    process.exit(1);
  }
  const trialEndUnix = Math.floor(trialEndDate.getTime() / 1000);

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!stripeKey || !supabaseUrl || !serviceKey) {
    console.error("Missing env vars (STRIPE_SECRET_KEY / SUPABASE_*)");
    process.exit(1);
  }

  const stripe = new Stripe(stripeKey);
  const supabase = createClient(supabaseUrl, serviceKey);

  console.log("=== Pre-flight checks ===");
  const { data: studio, error: studioErr } = await supabase
    .from("studios")
    .select("id, name, stripe_subscription_id, plan_status")
    .eq("id", studioId)
    .single();
  if (studioErr || !studio) {
    console.error("Studio not found:", studioErr?.message);
    process.exit(1);
  }
  console.log("Studio:", studio.name, "| current sub:", studio.stripe_subscription_id, "| status:", studio.plan_status);

  if (studio.stripe_subscription_id !== oldSubId) {
    console.error(
      `Studio's stripe_subscription_id (${studio.stripe_subscription_id}) does not match --old-sub (${oldSubId}). Aborting.`
    );
    process.exit(1);
  }

  const oldSub = await stripe.subscriptions.retrieve(oldSubId);
  const customerId =
    typeof oldSub.customer === "string" ? oldSub.customer : oldSub.customer.id;
  console.log("Stripe customer:", customerId);
  const itemPeriodEnd = oldSub.items?.data?.[0]?.current_period_end;
  const periodEndStr = itemPeriodEnd ? new Date(itemPeriodEnd * 1000).toISOString() : "(unknown)";
  console.log("Old sub status:", oldSub.status, "| current_period_end:", periodEndStr);
  if (oldSub.trial_end) {
    console.log("Old sub trial_end:", new Date(oldSub.trial_end * 1000).toISOString());
  }

  const customer = await stripe.customers.retrieve(customerId);
  const defaultPm = customer.invoice_settings?.default_payment_method;
  const defaultPmId = typeof defaultPm === "string" ? defaultPm : defaultPm?.id;
  console.log("Default payment method on customer:", defaultPmId || "(none)");

  const subDefaultPm = oldSub.default_payment_method;
  const subDefaultPmId = typeof subDefaultPm === "string" ? subDefaultPm : subDefaultPm?.id;
  console.log("Default payment method on subscription:", subDefaultPmId || "(none)");

  const pmsAll = await stripe.paymentMethods.list({ customer: customerId, limit: 20 });
  console.log(`Attached payment methods (any type): ${pmsAll.data.length}`);
  for (const pm of pmsAll.data) {
    const detail =
      pm.type === "card"
        ? `${pm.card?.brand} ****${pm.card?.last4} exp ${pm.card?.exp_month}/${pm.card?.exp_year}`
        : pm.type;
    console.log(`  - ${pm.id} [${pm.type}] ${detail}`);
  }

  // Try to recover PM from the last paid invoice if nothing is directly attached
  let invoicePmId = null;
  if (!defaultPmId && !subDefaultPmId && pmsAll.data.length === 0) {
    console.log("Looking up payment method from last paid invoice...");
    const invoices = await stripe.invoices.list({ customer: customerId, limit: 5 });
    for (const inv of invoices.data) {
      if (inv.status === "paid" && inv.payment_intent) {
        const piId = typeof inv.payment_intent === "string" ? inv.payment_intent : inv.payment_intent.id;
        const pi = await stripe.paymentIntents.retrieve(piId);
        const piPm = pi.payment_method;
        const piPmId = typeof piPm === "string" ? piPm : piPm?.id;
        if (piPmId) {
          console.log(`  invoice ${inv.id} paid with PM ${piPmId}`);
          invoicePmId = piPmId;
          break;
        }
      }
    }
  }

  const chosenPmId = defaultPmId || subDefaultPmId || pmsAll.data[0]?.id || invoicePmId;
  if (!chosenPmId) {
    console.error("No payment method available. Aborting — Sarah would need to re-enter card.");
    process.exit(1);
  }
  console.log("Will use payment method for new sub:", chosenPmId);

  if (dryRun) {
    console.log("\n[DRY RUN] Would create new sub with:");
    console.log("  customer:", customerId);
    console.log("  price:", priceId);
    console.log("  trial_end:", trialEndDate.toISOString(), `(unix ${trialEndUnix})`);
    console.log("  metadata.studio_id:", studioId);
    console.log("[DRY RUN] Would then set studios.stripe_subscription_id to new id");
    console.log("[DRY RUN] Would then cancel old sub", oldSubId);
    return;
  }

  console.log("\n=== Step 1: create new subscription ===");
  const newSub = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    trial_end: trialEndUnix,
    default_payment_method: chosenPmId,
    metadata: { studio_id: studioId },
    payment_settings: {
      save_default_payment_method: "on_subscription",
    },
    collection_method: "charge_automatically",
  });
  console.log("Created:", newSub.id, "| status:", newSub.status, "| trial_end:", new Date(newSub.trial_end * 1000).toISOString());

  console.log("\n=== Step 2: swap stripe_subscription_id on studio ===");
  const { error: updErr } = await supabase
    .from("studios")
    .update({
      stripe_subscription_id: newSub.id,
      plan_status: "trialing",
      cancel_at_period_end: false,
      trial_ends_at: trialEndStr,
    })
    .eq("id", studioId);
  if (updErr) {
    console.error("Failed to update studio. New sub left in Stripe:", newSub.id);
    console.error(updErr);
    process.exit(1);
  }
  console.log("Studio updated.");

  console.log("\n=== Step 3: cancel old subscription ===");
  const cancelled = await stripe.subscriptions.cancel(oldSubId, {
    invoice_now: false,
    prorate: false,
  });
  console.log("Cancelled:", cancelled.id, "| status:", cancelled.status);

  console.log("\n=== Done ===");
  console.log("New subscription:", newSub.id);
  console.log("Next charge:", new Date(newSub.trial_end * 1000).toISOString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
