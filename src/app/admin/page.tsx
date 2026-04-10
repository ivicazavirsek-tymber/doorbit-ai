import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    userCount,
    gen24h,
    genTotal,
    genOk,
    balances,
  ] = await Promise.all([
    supabase.from("profiles").select("user_id", { count: "exact", head: true }),
    supabase
      .from("ai_generations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since24h),
    supabase.from("ai_generations").select("id", { count: "exact", head: true }),
    supabase
      .from("ai_generations")
      .select("id", { count: "exact", head: true })
      .eq("status", "succeeded"),
    supabase.from("credit_balances").select("balance_tokens"),
  ]);

  let totalTokens = 0;
  for (const row of balances.data ?? []) {
    totalTokens += Number((row as { balance_tokens: number }).balance_tokens) || 0;
  }

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link href="/dashboard" className="text-sm font-medium text-sky-400">
            ← Kontrolna tabla
          </Link>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-2 text-zinc-400">
          Ulogovan kao{" "}
          <span className="text-zinc-200">
            {profile?.display_name || user.email}
          </span>
          .
        </p>

        <section className="mt-10 grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Registrovanih korisnika"
            value={String(userCount.count ?? 0)}
          />
          <StatCard
            label="Generacija (24h)"
            value={String(gen24h.count ?? 0)}
          />
          <StatCard
            label="Generacija (ukupno)"
            value={String(genTotal.count ?? 0)}
          />
          <StatCard
            label="Uspešnih generacija"
            value={String(genOk.count ?? 0)}
          />
          <StatCard
            label="Zbir tokena (svi balansi)"
            value={String(totalTokens)}
          />
        </section>

        <nav className="mt-10 flex flex-wrap gap-4 text-sm">
          <Link
            href="/admin/users"
            className="rounded-lg border border-zinc-600 px-4 py-2 font-medium text-zinc-200 hover:bg-zinc-800"
          >
            Korisnici
          </Link>
          <Link
            href="/admin/audit"
            className="rounded-lg border border-zinc-600 px-4 py-2 font-medium text-zinc-200 hover:bg-zinc-800"
          >
            Audit log
          </Link>
        </nav>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-100">
        {value}
      </p>
    </div>
  );
}
