import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";
import { getStripePriceId, type StripePlanKey } from "@/lib/stripe/plans";

export type StripePricingCard = {
  planKey: StripePlanKey;
  title: string;
  cycle: "monthly" | "yearly";
  cycleLabel: string;
  description: string;
  priceLabel: string;
};

const PLAN_META: Record<
  StripePlanKey,
  { title: string; cycle: "monthly" | "yearly"; cycleLabel: string; description: string; suffix: string }
> = {
  starter_monthly: {
    title: "Starter",
    cycle: "monthly",
    cycleLabel: "Mesečno",
    description: "Pretplata + mesečni priliv tokena.",
    suffix: "/month",
  },
  pro_monthly: {
    title: "Pro",
    cycle: "monthly",
    cycleLabel: "Mesečno",
    description: "Više tokena po ciklusu.",
    suffix: "/month",
  },
  starter_yearly: {
    title: "Starter",
    cycle: "yearly",
    cycleLabel: "Godišnje",
    description: "Jedna godišnja naplata + tokeni po planu.",
    suffix: "/year",
  },
  pro_yearly: {
    title: "Pro",
    cycle: "yearly",
    cycleLabel: "Godišnje",
    description: "Najveći paket tokena uz godišnju naplatu.",
    suffix: "/year",
  },
};

function formatStripeAmount(
  amountMinor: number | null,
  currency: string | null,
  suffix: string
): string {
  if (amountMinor == null || !currency) return "Cena uskoro";
  const value = amountMinor / 100;
  try {
    const price = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(value);
    return `${price} ${suffix}`;
  } catch {
    return `${value.toFixed(2)} ${currency.toUpperCase()} ${suffix}`;
  }
}

async function loadPriceLabel(
  stripe: Stripe,
  planKey: StripePlanKey,
  suffix: string
): Promise<string> {
  const priceId = getStripePriceId(planKey);
  if (!priceId) return "Cena uskoro";
  try {
    const p = await stripe.prices.retrieve(priceId);
    return formatStripeAmount(p.unit_amount, p.currency, suffix);
  } catch {
    return "Cena uskoro";
  }
}

export async function loadStripePricingCards(): Promise<StripePricingCard[]> {
  const order: StripePlanKey[] = [
    "starter_monthly",
    "pro_monthly",
    "starter_yearly",
    "pro_yearly",
  ];

  let stripe: Stripe | null = null;
  try {
    stripe = getStripe();
  } catch {
    stripe = null;
  }

  return Promise.all(
    order.map(async (planKey) => {
      const meta = PLAN_META[planKey];
      const priceLabel = stripe
        ? await loadPriceLabel(stripe, planKey, meta.suffix)
        : "Cena uskoro";
      return {
        planKey,
        title: meta.title,
        cycle: meta.cycle,
        cycleLabel: meta.cycleLabel,
        description: meta.description,
        priceLabel,
      };
    })
  );
}
