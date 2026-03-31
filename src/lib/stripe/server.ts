import Stripe from "stripe";
import { getStripeSecretKey } from "@/lib/env";

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeSingleton) return stripeSingleton;
  const key = getStripeSecretKey();
  if (!key) {
    throw new Error("NEDOSTAJE_STRIPE_SECRET_KEY");
  }
  stripeSingleton = new Stripe(key, {
    typescript: true,
  });
  return stripeSingleton;
}
