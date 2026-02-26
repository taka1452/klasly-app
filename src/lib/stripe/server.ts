import Stripe from "stripe";

let _stripe: Stripe | null = null;

/**
 * Stripe server-side client.
 * Lazily initialized to avoid build failures when env vars are not available (e.g. Vercel build).
 * Throws when STRIPE_SECRET_KEY is not set at runtime.
 */
export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Please add it to your environment variables."
    );
  }
  _stripe = new Stripe(secretKey, { typescript: true });
  return _stripe;
}

/** @deprecated Use getStripe() for lazy init. Kept for backwards compatibility. */
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as unknown as Record<string, unknown>)[prop as string];
  },
});
