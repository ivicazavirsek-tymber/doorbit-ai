"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ImpersonateButton({ targetUserId }: { targetUserId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/impersonate/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ target_user_id: targetUserId }),
      });
      const data = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setErr(data?.error?.message || "Ne mogu da pokrenem pregled.");
        return;
      }
      router.push("/dashboard");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      {err ? <p className="mb-2 text-sm text-red-400">{err}</p> : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void start()}
        className="rounded-lg border border-sky-600/60 bg-sky-950/40 px-4 py-2 text-sm font-medium text-sky-200 hover:bg-sky-900/50 disabled:opacity-50"
      >
        {busy ? "…" : "Pregledaj kao ovog korisnika (dashboard)"}
      </button>
    </div>
  );
}
