"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type SyncState = "idle" | "syncing" | "error";

export function StripeCheckoutSync({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<SyncState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (searchParams.get("stripe") !== "success") return;

    let cancelled = false;

    async function run() {
      setState("syncing");
      setMessage("Proveravam uplatu i osvežavam tokene...");
      try {
        const res = await fetch("/api/stripe/sync-latest", {
          method: "POST",
          credentials: "include",
        });
        const data = (await res.json()) as {
          already_present?: boolean;
          error?: { message?: string; details?: unknown };
        };
        if (!res.ok) {
          if (!cancelled) {
            setState("error");
            setMessage(data?.error?.message || "Uplata je uspela, ali sync nije.");
          }
          return;
        }
        if (!cancelled) {
          const next = new URLSearchParams(searchParams.toString());
          next.delete("stripe");
          router.replace(next.size ? `${pathname}?${next.toString()}` : pathname);
          router.refresh();
        }
      } catch {
        if (!cancelled) {
          setState("error");
          setMessage("Uplata je uspela, ali lokalni sync nije mogao da se završi.");
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled, pathname, router, searchParams]);

  if (!enabled || !message) return null;

  return (
    <div
      className={
        state === "error"
          ? "mb-6 rounded-lg border border-red-700/50 bg-red-950/30 px-4 py-3 text-sm text-red-200"
          : "mb-6 rounded-lg border border-sky-700/50 bg-sky-950/30 px-4 py-3 text-sm text-sky-200"
      }
    >
      {message}
    </div>
  );
}
