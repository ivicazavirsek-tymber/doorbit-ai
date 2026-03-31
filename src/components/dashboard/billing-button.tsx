"use client";

import { useState } from "react";

export function BillingPortalButton() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function openPortal() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { url?: string; error?: { message?: string } };
      if (!res.ok) {
        setErr(data?.error?.message || "Portal nije dostupan.");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setErr("Stripe nije vratio URL.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 border-t border-zinc-800 pt-6">
      <h2 className="text-sm font-medium text-zinc-300">Naplata (Stripe)</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Upravljanje pretplatom i načinom plaćanja nakon prve kupovine.
      </p>
      {err ? <p className="mt-2 text-sm text-red-400">{err}</p> : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void openPortal()}
        className="mt-3 rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-50"
      >
        {busy ? "…" : "Otvori Stripe portal"}
      </button>
    </div>
  );
}
