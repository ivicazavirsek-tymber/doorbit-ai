import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <span className="text-lg font-semibold tracking-tight">DoorBit AI</span>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/pricing" className="text-zinc-400 hover:text-zinc-200">
              Cenovnik
            </Link>
            <Link href="/login" className="text-zinc-400 hover:text-zinc-200">
              Prijava
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500"
            >
              Registracija
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex max-w-4xl flex-1 flex-col justify-center px-6 py-24">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          AI sadržaj za tvoj salon
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-400">
          Generiši slike i tekst za društvene mreže — uz kontrolu kredita i
          bezbednu prijavu.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/register"
            className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
          >
            Započni
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-zinc-600 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:border-zinc-500"
          >
            Kontrolna tabla
          </Link>
        </div>
      </main>
    </div>
  );
}
