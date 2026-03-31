import Link from "next/link";
import { SubscribeButtons } from "@/components/pricing/subscribe-buttons";

export default function PricingPage() {
  return (
    <div className="min-h-full bg-zinc-950 px-6 py-16 text-zinc-100">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="text-sm font-medium text-sky-400 hover:text-sky-300"
        >
          ← Početna
        </Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight">Cenovnik</h1>
        <p className="mt-4 max-w-2xl text-zinc-400">
          Pretplate se naplaćuju preko Stripe-a. Posle uspešne uplate, tokeni se
          automatski dodaju na nalog (vidi plan u kodu / env). Prijavi se pre
          kupovine.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/register"
            className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
          >
            Registracija
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-zinc-600 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:border-zinc-500"
          >
            Prijava
          </Link>
        </div>
        <SubscribeButtons />
      </div>
    </div>
  );
}
