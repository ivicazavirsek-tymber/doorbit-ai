import { appEnv } from "@/lib/env";

/** U skladu sa `plan_key` u bazi (`stripe_subscriptions`, `checkout_sessions`). */
export type StripePlanKey =
  | "starter_monthly"
  | "pro_monthly"
  | "starter_yearly"
  | "pro_yearly";

export const STRIPE_PLAN_KEYS: StripePlanKey[] = [
  "starter_monthly",
  "pro_monthly",
  "starter_yearly",
  "pro_yearly",
];

export function isStripePlanKey(s: string): s is StripePlanKey {
  return STRIPE_PLAN_KEYS.includes(s as StripePlanKey);
}

/** Podrazumevani mesečni/godišnji priliv tokena po planu (može override preko env). */
const DEFAULT_TOKEN_GRANTS: Record<StripePlanKey, number> = {
  starter_monthly: 500,
  pro_monthly: 2000,
  starter_yearly: 6000,
  pro_yearly: 24000,
};

const ENV_TOKEN_KEYS: Record<StripePlanKey, string> = {
  starter_monthly: "STRIPE_TOKENS_STARTER_MONTHLY",
  pro_monthly: "STRIPE_TOKENS_PRO_MONTHLY",
  starter_yearly: "STRIPE_TOKENS_STARTER_YEARLY",
  pro_yearly: "STRIPE_TOKENS_PRO_YEARLY",
};

export function getTokenGrantForPlan(plan: StripePlanKey): number {
  const envName = ENV_TOKEN_KEYS[plan];
  const n = Number(process.env[envName]);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return DEFAULT_TOKEN_GRANTS[plan];
}

export function getStripePriceId(plan: StripePlanKey): string {
  const prod = appEnv() === "prod";
  const map: Record<StripePlanKey, string | undefined> = {
    starter_monthly: prod
      ? process.env.STRIPE_PRICE_STARTER_MONTHLY_ID_PROD
      : process.env.STRIPE_PRICE_STARTER_MONTHLY_ID_DEV,
    pro_monthly: prod
      ? process.env.STRIPE_PRICE_PRO_MONTHLY_ID_PROD
      : process.env.STRIPE_PRICE_PRO_MONTHLY_ID_DEV,
    starter_yearly: prod
      ? process.env.STRIPE_PRICE_STARTER_YEARLY_ID_PROD
      : process.env.STRIPE_PRICE_STARTER_YEARLY_ID_DEV,
    pro_yearly: prod
      ? process.env.STRIPE_PRICE_PRO_YEARLY_ID_PROD
      : process.env.STRIPE_PRICE_PRO_YEARLY_ID_DEV,
  };
  return (map[plan] || "").trim();
}

export function planKeyFromStripePriceId(priceId: string): StripePlanKey | null {
  for (const key of STRIPE_PLAN_KEYS) {
    if (getStripePriceId(key) === priceId) return key;
  }
  return null;
}
