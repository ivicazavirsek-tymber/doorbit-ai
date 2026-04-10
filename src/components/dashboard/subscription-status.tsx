import Link from "next/link";

type Props = {
  planKey: string | null;
  status: string | null;
  cancelAtPeriodEnd: boolean | null;
  currentPeriodEnd: string | null;
};

const PLAN_LABELS: Record<string, string> = {
  starter_monthly: "Starter (mesečno)",
  pro_monthly: "Pro (mesečno)",
  starter_yearly: "Starter (godišnje)",
  pro_yearly: "Pro (godišnje)",
};

function fmtDate(v: string | null): string {
  if (!v) return "n/a";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "n/a";
  return new Intl.DateTimeFormat("sr-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function hasAccessNow(status: string | null, currentPeriodEnd: string | null): boolean {
  if (!status) return false;
  if (!["active", "trialing", "past_due"].includes(status)) return false;
  if (!currentPeriodEnd) return true;
  const end = new Date(currentPeriodEnd).getTime();
  if (Number.isNaN(end)) return true;
  return Date.now() < end;
}

export function SubscriptionStatusCard({
  planKey,
  status,
  cancelAtPeriodEnd,
  currentPeriodEnd,
}: Props) {
  if (!status) {
    return (
      <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="text-sm font-medium text-zinc-300">Pretplata</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Nema aktivne pretplate.{" "}
          <Link
            href="/pricing"
            className="font-medium text-sky-400 underline-offset-2 hover:text-sky-300 hover:underline"
          >
            Izaberi plan na cenovniku
          </Link>
          .
        </p>
      </section>
    );
  }

  const active = hasAccessNow(status, currentPeriodEnd);
  const planLabel = planKey ? PLAN_LABELS[planKey] || planKey : "n/a";
  const end = fmtDate(currentPeriodEnd);

  let info = "Pretplata je aktivna.";
  if (cancelAtPeriodEnd && active) {
    info = `Pretplata je otkazana, ali i dalje važi do ${end}.`;
  } else if (!active) {
    info = "Pretplata je istekla ili nije aktivna.";
  }

  return (
    <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <h2 className="text-sm font-medium text-zinc-300">Pretplata</h2>
      <p className="mt-2 text-sm text-zinc-200">{info}</p>
      <p className="mt-1 text-xs text-zinc-500">
        Plan: {planLabel} · Status: {status} · Važi do: {end}
      </p>
    </section>
  );
}
