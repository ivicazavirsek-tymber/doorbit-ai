"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdjustTokensForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    const d = Number(delta);
    if (!Number.isFinite(d) || d === 0 || !Number.isInteger(d)) {
      setErr("delta mora biti ceo broj različit od nule (npr. 500 ili -100).");
      return;
    }
    if (reason.trim().length < 2) {
      setErr("Razlog mora imati bar 2 karaktera.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/adjust-tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ delta: d, reason: reason.trim() }),
      });
      const data = (await res.json()) as {
        new_balance?: number;
        error?: { message?: string };
      };
      if (!res.ok) {
        setErr(data?.error?.message || "Greška.");
        return;
      }
      setMsg(
        typeof data.new_balance === "number"
          ? `Novo stanje: ${data.new_balance} tokena.`
          : "Ažurirano."
      );
      setDelta("");
      setReason("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-3">
      <h2 className="text-sm font-medium text-zinc-300">Korekcija tokena</h2>
      <p className="text-xs text-zinc-500">
        Pozitivno dodaje tokene, negativno ih skida (ako korisnik ima dovoljno).
      </p>
      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      {msg ? <p className="text-sm text-emerald-400">{msg}</p> : null}
      <div className="flex flex-wrap gap-3">
        <label className="block text-xs text-zinc-400">
          delta
          <input
            type="number"
            step={1}
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            className="mt-1 block w-36 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
            placeholder="npr. 500 ili -50"
            required
          />
        </label>
        <label className="block min-w-[200px] flex-1 text-xs text-zinc-400">
          razlog
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
            placeholder="Kratak razlog (interno)"
            required
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
      >
        {busy ? "…" : "Primeni"}
      </button>
    </form>
  );
}
