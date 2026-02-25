import { loadStripe, Stripe } from "@stripe/stripe-js";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

export async function getStripeClient(): Promise<Stripe | null> {
  if (!publishableKey || publishableKey === "pk_test_xxx") {
    return null;
  }
  return loadStripe(publishableKey);
}
