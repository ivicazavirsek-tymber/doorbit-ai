"use client";

import { useState } from "react";
import type { StripePlanKey } from "@/lib/stripe/plans";
import type { StripePricingCard } from "@/lib/stripe/pricing-cards";

export type PricingCard = StripePricingCard;

type Props = {
  cards: PricingCard[];
};

export function SubscribeButtons({ cards }: Props) {
  const [busy, setBusy] = useState<StripePlanKey | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function go(plan_key: StripePlanKey) {
    setErr(null);
    setBusy(plan_key);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_key }),
      });
      const data = (await res.json()) as { url?: string; error?: { message?: string } };
      if (!res.ok) {
        setErr(data?.error?.message || "Ne mogu da otvorim checkout.");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setErr("Stripe nije vratio URL.");
    } finally {
      setBusy(null);
    }
  }

  const btn =
    "rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50";
  const primary = "bg-sky-600 text-white hover:bg-sky-500";
  const secondary = "border border-zinc-600 text-zinc-200 hover:border-zinc-500";

  return (
    <div className="mt-8 space-y-4">
      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const featured = card.planKey === "pro_monthly" || card.planKey === "pro_yearly";
          const cardClass = featured
            ? "rounded-xl border border-sky-900/50 bg-sky-950/20 p-5 ring-1 ring-sky-800/30"
            : "rounded-xl border border-zinc-800 bg-zinc-900/40 p-5";
          const buttonStyle = card.planKey.includes("monthly") ? primary : secondary;
          return (
            <div key={card.planKey} className={cardClass}>
              <h2 className="text-lg font-semibold text-zinc-100">{card.title}</h2>
              <p className="mt-1 text-xs text-zinc-500">{card.cycle}</p>
              <p className="mt-3 text-2xl font-semibold text-zinc-100">{card.priceLabel}</p>
              <p className="mt-3 text-sm text-zinc-400">{card.description}</p>
              <button
                type="button"
                disabled={busy !== null}
                className={`${btn} ${buttonStyle} mt-4 w-full`}
                onClick={() => void go(card.planKey)}
              >
                {busy === card.planKey ? "…" : "Pretplati se"}
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-zinc-600">
        Cene se čitaju direktno iz Stripe Price konfiguracije (preko `STRIPE_PRICE_*_ID_*`).
      </p>
    </div>
  );
}
