import Link from "next/link";
import { SubscribeButtons } from "@/components/pricing/subscribe-buttons";
import { loadStripePricingCards } from "@/lib/stripe/pricing-cards";

export default async function PricingPage() {
  const cards = await loadStripePricingCards();
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
          automatski dodaju na postojeći balans na nalogu. Prijavi se pre
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
        <SubscribeButtons cards={cards} />

        <section className="mt-16 max-w-2xl border-t border-zinc-800 pt-12">
          <h2 className="text-lg font-semibold text-zinc-100">Česta pitanja</h2>
          <dl className="mt-6 space-y-6 text-sm text-zinc-400">
            <div>
              <dt className="font-medium text-zinc-300">Šta su tokeni?</dt>
              <dd className="mt-1 leading-relaxed">
                Tokeni su krediti za generisanje (npr. slika i tekst troše različite
                iznose). Vidi kontrolnu tablu za tačne cene po akciji.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-300">Da li se balans resetuje svakog meseca?</dt>
              <dd className="mt-1 leading-relaxed">
                Ne kao „brisanje stanja“: pri naplati pretplate novi mesečni priliv
                tokena <span className="text-zinc-300">dodaje se</span> na ono što
                već imaš.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-300">Mogu li da promenim plan kasnije?</dt>
              <dd className="mt-1 leading-relaxed">
                Upravljanje pretplatom (nadogradnja, otkaz) ide preko Stripe
                customer portala sa kontrolne table, kada si ulogovan.
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
