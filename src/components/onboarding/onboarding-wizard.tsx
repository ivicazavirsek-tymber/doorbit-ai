"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { StripePlanKey } from "@/lib/stripe/plans";
import type { StripePricingCard } from "@/lib/stripe/pricing-cards";

type Props = {
  email: string;
  initialBusinessName: string;
  initialMainCity: string;
  initialDoorStyles: string[];
  cards: StripePricingCard[];
};

const STYLE_OPTIONS = [
  "Ulazna vrata",
  "Sobna vrata",
  "Klizna vrata",
  "Protivpožarna vrata",
  "Staklena vrata",
  "Alu/PVC stolarija",
  "Sigurnosna vrata",
  "Enterijerski paneli",
];

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none ring-sky-500 focus:ring-1";

export function OnboardingWizard({
  email,
  initialBusinessName,
  initialMainCity,
  initialDoorStyles,
  cards,
}: Props) {
  const [step, setStep] = useState(1);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [mainCity, setMainCity] = useState(initialMainCity);
  const [doorStyles, setDoorStyles] = useState<string[]>(initialDoorStyles);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleCards = useMemo(
    () => cards.filter((c) => c.cycle === billingCycle),
    [cards, billingCycle]
  );

  function toggleStyle(v: string) {
    setDoorStyles((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
    );
  }

  async function save(onboardingCompleted: boolean) {
    const res = await fetch("/api/onboarding/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        business_name: businessName,
        main_city: mainCity,
        door_styles: doorStyles,
        onboarding_completed: onboardingCompleted,
      }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: { message?: string } };
      throw new Error(data?.error?.message || "Neuspešno čuvanje onboarding podataka.");
    }
  }

  async function nextFromBusiness() {
    if (!businessName.trim()) {
      setError("Naziv biznisa je obavezan.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await save(false);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Greška.");
    } finally {
      setBusy(false);
    }
  }

  async function nextFromStyles() {
    setBusy(true);
    setError(null);
    try {
      await save(false);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Greška.");
    } finally {
      setBusy(false);
    }
  }

  async function choosePlan(planKey: StripePlanKey) {
    setBusy(true);
    setError(null);
    try {
      const checkout = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan_key: planKey }),
      });
      const data = (await checkout.json()) as {
        url?: string;
        error?: { message?: string };
      };
      if (!checkout.ok || !data.url) {
        throw new Error(data?.error?.message || "Ne mogu da otvorim Stripe checkout.");
      }

      await save(true);
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Greška prilikom checkout-a.");
      setBusy(false);
    }
  }

  const stepIndicator = (n: number) =>
    n <= step
      ? "h-1.5 w-12 rounded-full bg-sky-500"
      : "h-1.5 w-12 rounded-full bg-zinc-700";

  return (
    <div className="mx-auto mt-6 max-w-xl">
      <div className="mb-6 text-center">
        <Link
          href="/"
          className="text-sm font-medium text-sky-400 hover:text-sky-300"
        >
          DoorBit AI
        </Link>
        <p className="mt-2 text-xs text-zinc-500">
          Korak {step} od 3 — podešavanje naloga
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl shadow-black/20 backdrop-blur-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className={stepIndicator(1)} />
          <div className={stepIndicator(2)} />
          <div className={stepIndicator(3)} />
        </div>

        {error ? (
          <p className="mb-4 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        {step === 1 ? (
          <section>
            <h2 className="text-2xl font-semibold text-zinc-50">O vašem biznisu</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Ovi podaci ulaze u AI kontekst pri generisanju.
            </p>
            <div className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-zinc-300">Naziv biznisa</label>
                <input
                  className={inputClass}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="npr. DoorBit Studio"
                  disabled={busy}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-300">Lokacija</label>
                <input
                  className={inputClass}
                  value={mainCity}
                  onChange={(e) => setMainCity(e.target.value)}
                  placeholder="npr. Novi Sad"
                  disabled={busy}
                />
              </div>
              <p className="text-xs text-zinc-500">Nalog: {email}</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void nextFromBusiness()}
                className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-60"
              >
                {busy ? "Čuvanje…" : "Dalje"}
              </button>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section>
            <h2 className="text-2xl font-semibold text-zinc-50">Vaši proizvodi</h2>
            <p className="mt-1 text-sm text-zinc-500">Izaberi tipove proizvoda koje nudite.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {STYLE_OPTIONS.map((opt) => {
                const selected = doorStyles.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleStyle(opt)}
                    disabled={busy}
                    className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${
                      selected
                        ? "border-sky-500 bg-sky-500/15 text-sky-100"
                        : "border-zinc-700 bg-zinc-950/80 text-zinc-300 hover:border-zinc-600"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setStep(1)}
                className="rounded-lg border border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800/80"
              >
                Nazad
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void nextFromStyles()}
                className="rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? "Čuvanje…" : "Dalje"}
              </button>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section>
            <h2 className="text-2xl font-semibold text-zinc-50">Izaberite plan</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Plaćanje je bezbedno preko Stripe checkout-a. Tokeni se dodaju na nalog
              posle uspešne uplate.
            </p>
            <div className="mt-4 inline-flex rounded-lg border border-zinc-700 p-1">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  billingCycle === "monthly"
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-400 hover:bg-zinc-800/80"
                }`}
              >
                Mesečno
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("yearly")}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  billingCycle === "yearly"
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-400 hover:bg-zinc-800/80"
                }`}
              >
                Godišnje
              </button>
            </div>
            <div className="mt-5 space-y-3">
              {visibleCards.map((card) => {
                const featured = card.planKey.startsWith("pro_");
                return (
                  <article
                    key={card.planKey}
                    className={`rounded-xl border p-4 ${
                      featured
                        ? "border-sky-600/40 bg-sky-950/20 ring-1 ring-sky-800/30"
                        : "border-zinc-800 bg-zinc-950/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-semibold text-zinc-100">{card.title}</h3>
                        <p className="text-xs text-zinc-500">{card.cycleLabel}</p>
                      </div>
                      <p className="text-xl font-semibold text-zinc-100">{card.priceLabel}</p>
                    </div>
                    <p className="mt-2 text-sm text-zinc-400">{card.description}</p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void choosePlan(card.planKey)}
                      className={`mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                        featured
                          ? "bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-60"
                          : "border border-zinc-600 text-zinc-100 hover:bg-zinc-800/80 disabled:opacity-60"
                      }`}
                    >
                      {busy ? "Čuvanje…" : `Izaberi ${card.title}`}
                    </button>
                  </article>
                );
              })}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => setStep(2)}
              className="mt-4 rounded-lg border border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800/80"
            >
              Nazad
            </button>
          </section>
        ) : null}
      </div>
    </div>
  );
}
