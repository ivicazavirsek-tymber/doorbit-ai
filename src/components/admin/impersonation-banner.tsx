"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ImpersonationBanner({ targetEmail }: { targetEmail: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function end() {
    setBusy(true);
    try {
      await fetch("/api/admin/impersonate/end", {
        method: "POST",
        credentials: "include",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 rounded-lg border border-amber-600/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
      <span className="text-amber-200/90">Pregled korisnika:</span>{" "}
      <strong className="text-amber-50">{targetEmail}</strong>
      <button
        type="button"
        disabled={busy}
        onClick={() => void end()}
        className="ml-4 rounded-md border border-amber-500/60 px-2 py-1 text-xs font-medium text-amber-100 hover:bg-amber-900/50 disabled:opacity-50"
      >
        {busy ? "…" : "Završi pregled"}
      </button>
    </div>
  );
}
