import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800/80 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            DoorBit AI
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link
              href="/pricing"
              className="text-zinc-400 transition hover:text-zinc-200"
            >
              Cenovnik
            </Link>
            <Link
              href="/login"
              className="text-zinc-400 transition hover:text-zinc-200"
            >
              Prijava
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white transition hover:bg-sky-500"
            >
              Registracija
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-zinc-800/60 px-6 pb-20 pt-16 sm:pt-24">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(14,165,233,0.18),transparent)]"
            aria-hidden
          />
          <div className="relative mx-auto max-w-5xl">
            <p className="text-sm font-medium uppercase tracking-wider text-sky-400/90">
              Za proizvodnju vrata i stolarije
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl sm:leading-tight">
              AI sadržaj za tvoj salon — slike i tekst, jedan nalog
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
              Generiši vizuale i marketing copy za društvene mreže i sajt. Krediti
              (tokeni) na kontrolnoj tabli; plaćanje preko Stripe pretplate kada
              budeš spreman.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/register"
                className="rounded-lg bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-950/40 transition hover:bg-sky-500"
              >
                Započni besplatnu registraciju
              </Link>
              <Link
                href="/pricing"
                className="rounded-lg border border-zinc-600 px-6 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900/50"
              >
                Pogledaj planove
              </Link>
            </div>
          </div>
        </section>

        <section className="px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              Šta dobijaš
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-zinc-400">
              Tri glavna modula na istoj kontrolnoj tabli — bez posebnih alata za
              svaku mrežu.
            </p>
            <ul className="mt-12 grid gap-6 sm:grid-cols-3">
              <li className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/15 text-xs font-bold text-sky-400">
                  TXT
                </div>
                <h3 className="mt-4 text-lg font-semibold text-zinc-100">
                  Slika iz opisa
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Tekstualni prompt → vizuelni predlog prostora ili proizvoda,
                  spreman za objavu.
                </p>
              </li>
              <li className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/15 text-xs font-bold text-sky-400">
                  FOTO
                </div>
                <h3 className="mt-4 text-lg font-semibold text-zinc-100">
                  Slika iz fotografije
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Otpremiš foto prostora, dodaš kratak opis — AI predlaže izgled
                  uz tvoj kontekst iz profila.
                </p>
              </li>
              <li className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/15 text-xs font-bold text-sky-400">
                  COPY
                </div>
                <h3 className="mt-4 text-lg font-semibold text-zinc-100">
                  Marketing tekst
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Copy po tvom briefu (ton, dužina, jezik); opciono sa referentnom
                  slikom.
                </p>
              </li>
            </ul>
          </div>
        </section>

        <section className="border-t border-zinc-800/60 bg-zinc-900/20 px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              Kako počinje
            </h2>
            <ol className="mx-auto mt-12 grid max-w-3xl gap-8 sm:grid-cols-3">
              <li className="relative text-center">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
                  1
                </span>
                <p className="mt-4 text-sm font-medium text-zinc-200">
                  Registracija i kratak onboarding
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  Biznis, lokacija i tip proizvoda — koristi se u AI kontekstu.
                </p>
              </li>
              <li className="relative text-center">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
                  2
                </span>
                <p className="mt-4 text-sm font-medium text-zinc-200">
                  Pretplata (Stripe)
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  Mesečno ili godišnje; tokeni se dodaju na nalog posle uplate.
                </p>
              </li>
              <li className="relative text-center">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
                  3
                </span>
                <p className="mt-4 text-sm font-medium text-zinc-200">
                  Generisanje na dashboardu
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  Istorija i stanje kredita na jednom mestu.
                </p>
              </li>
            </ol>
            <div className="mt-14 flex flex-wrap justify-center gap-4">
              <Link
                href="/dashboard"
                className="rounded-lg border border-zinc-600 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800/80"
              >
                Već imaš nalog — kontrolna tabla
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-800 px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-6 sm:flex-row">
          <p className="text-sm text-zinc-500">
            © {new Date().getFullYear()} DoorBit AI
          </p>
          <nav className="flex flex-wrap justify-center gap-6 text-sm text-zinc-400">
            <Link href="/pricing" className="hover:text-zinc-200">
              Cenovnik
            </Link>
            <Link href="/login" className="hover:text-zinc-200">
              Prijava
            </Link>
            <Link href="/register" className="hover:text-zinc-200">
              Registracija
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
