"use client";

import { useState } from "react";

type PlanKey =
  | "starter_monthly"
  | "pro_monthly"
  | "starter_yearly"
  | "pro_yearly";

export function SubscribeButtons() {
  const [busy, setBusy] = useState<PlanKey | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function go(plan_key: PlanKey) {
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
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="text-lg font-semibold text-zinc-100">Starter</h2>
          <p className="mt-1 text-xs text-zinc-500">Mesečno</p>
          <p className="mt-3 text-sm text-zinc-400">
            Pretplata + mesečni priliv tokena (podešavaš u Stripe-u).
          </p>
          <button
            type="button"
            disabled={busy !== null}
            className={`${btn} ${primary} mt-4 w-full`}
            onClick={() => void go("starter_monthly")}
          >
            {busy === "starter_monthly" ? "…" : "Pretplati se"}
          </button>
        </div>
        <div className="rounded-xl border border-sky-900/50 bg-sky-950/20 p-5 ring-1 ring-sky-800/30">
          <h2 className="text-lg font-semibold text-zinc-100">Pro</h2>
          <p className="mt-1 text-xs text-zinc-500">Mesečno</p>
          <p className="mt-3 text-sm text-zinc-400">
            Više tokena po ciklusu (cena u Stripe Dashboard-u).
          </p>
          <button
            type="button"
            disabled={busy !== null}
            className={`${btn} ${primary} mt-4 w-full`}
            onClick={() => void go("pro_monthly")}
          >
            {busy === "pro_monthly" ? "…" : "Pretplati se"}
          </button>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="text-lg font-semibold text-zinc-100">Starter</h2>
          <p className="mt-1 text-xs text-zinc-500">Godišnje</p>
          <p className="mt-3 text-sm text-zinc-400">
            Jedna godišnja naplata + tokeni po planu.
          </p>
          <button
            type="button"
            disabled={busy !== null}
            className={`${btn} ${secondary} mt-4 w-full`}
            onClick={() => void go("starter_yearly")}
          >
            {busy === "starter_yearly" ? "…" : "Pretplati se"}
          </button>
        </div>
        <div className="rounded-xl border border-sky-900/50 bg-sky-950/20 p-5 ring-1 ring-sky-800/30">
          <h2 className="text-lg font-semibold text-zinc-100">Pro</h2>
          <p className="mt-1 text-xs text-zinc-500">Godišnje</p>
          <p className="mt-3 text-sm text-zinc-400">
            Najveći paket tokena uz godišnju naplatu.
          </p>
          <button
            type="button"
            disabled={busy !== null}
            className={`${btn} ${secondary} mt-4 w-full`}
            onClick={() => void go("pro_yearly")}
          >
            {busy === "pro_yearly" ? "…" : "Pretplati se"}
          </button>
        </div>
      </div>
      <p className="text-xs text-zinc-600">
        U .env postavi STRIPE_PRICE_*_ID_DEV i webhook secret; detalji u plan.md
        (faza 7).
      </p>
    </div>
  );
}
