import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error(
    "STRIPE_SECRET_KEY is not set. Please add it to your .env.local file."
  );
}

/**
 * Stripe server-side client.
 * Uses the API version bundled with the stripe npm package.
 */
export const stripe = new Stripe(secretKey, {
  typescript: true,
});
