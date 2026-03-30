import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="min-h-full bg-zinc-950 px-6 py-16 text-zinc-100">
      <div className="mx-auto max-w-lg text-center">
        <Link
          href="/"
          className="text-sm font-medium text-sky-400 hover:text-sky-300"
        >
          ← Početna
        </Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight">Cenovnik</h1>
        <p className="mt-4 text-zinc-400">
          Planovi i Stripe integracija dolaze u Fazi 7. Do tada možeš da istražiš
          aplikaciju nakon prijave.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
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
      </div>
    </div>
  );
}
