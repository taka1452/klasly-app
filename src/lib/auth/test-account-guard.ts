import { createClient } from "@supabase/supabase-js";

/**
 * Guard that prevents test accounts from initiating real Stripe activity.
 *
 * Test accounts (user_metadata.is_test_account=true) exist so that owners
 * can preview the instructor / member side of the app without impersonating
 * real users. They must NEVER be able to move real money — that would mean
 * a real card is charged or a real Stripe subscription created under a
 * fake identity.
 *
 * Call this from every Stripe-initiating API route before touching Stripe.
 * Returns true if the caller is a test account (and the route should abort).
 */
export async function isTestAccount(userId: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    return data?.user?.user_metadata?.is_test_account === true;
  } catch {
    return false;
  }
}

export const TEST_ACCOUNT_STRIPE_ERROR =
  "Test accounts cannot perform real Stripe actions. Return to your owner account to run payments.";
