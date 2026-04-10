import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdjustTokensForm } from "@/components/admin/adjust-tokens-form";
import { ImpersonateButton } from "@/components/admin/impersonate-button";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { id: targetUserId } = await params;

  if (!targetUserId || !/^[0-9a-f-]{36}$/i.test(targetUserId)) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  let service;
  try {
    service = createServiceRoleClient();
  } catch {
    return (
      <div className="min-h-full bg-zinc-950 px-6 py-12 text-zinc-100">
        <p className="text-red-400">Nedostaje SUPABASE_SERVICE_ROLE_KEY na serveru.</p>
      </div>
    );
  }

  const { data: authUser, error: authErr } =
    await service.auth.admin.getUserById(targetUserId);
  if (authErr || !authUser.user) {
    notFound();
  }

  const [{ data: userProfile }, { data: balance }, { data: subs }, { count: genCount }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", targetUserId).maybeSingle(),
      supabase
        .from("credit_balances")
        .select("balance_tokens, updated_at")
        .eq("user_id", targetUserId)
        .maybeSingle(),
      supabase
        .from("stripe_subscriptions")
        .select(
          "plan_key, status, cancel_at_period_end, current_period_end, stripe_subscription_id"
        )
        .eq("user_id", targetUserId)
        .order("current_period_end", { ascending: false, nullsFirst: false }),
      supabase
        .from("ai_generations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", targetUserId),
    ]);

  const email = authUser.user.email ?? "";

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link href="/admin/users" className="text-sm font-medium text-sky-400">
            ← Korisnici
          </Link>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Korisnik</h1>
        <p className="mt-1 font-mono text-sm text-zinc-500">{targetUserId}</p>

        <dl className="mt-8 space-y-3 text-sm">
          <div>
            <dt className="text-zinc-500">Email</dt>
            <dd className="text-zinc-100">{email || "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Prikazno ime</dt>
            <dd className="text-zinc-100">{userProfile?.display_name || "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Uloga</dt>
            <dd className="text-zinc-100">{userProfile?.role ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Token balans</dt>
            <dd className="tabular-nums text-zinc-100">
              {balance?.balance_tokens != null ? String(balance.balance_tokens) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Generacija (ukupno)</dt>
            <dd className="tabular-nums text-zinc-100">{genCount ?? 0}</dd>
          </div>
        </dl>

        <section className="mt-8">
          <h2 className="text-sm font-medium text-zinc-300">Pretplate (Stripe)</h2>
          {subs && subs.length > 0 ? (
            <ul className="mt-2 space-y-2 text-sm text-zinc-400">
              {subs.map((s) => (
                <li key={s.stripe_subscription_id} className="rounded-lg border border-zinc-800 px-3 py-2">
                  <span className="text-zinc-200">{s.plan_key}</span> · {s.status}
                  {s.current_period_end
                    ? ` · do ${new Date(s.current_period_end).toLocaleDateString("sr-RS")}`
                    : ""}
                  {s.cancel_at_period_end ? " · otkazana na kraju perioda" : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">Nema zapisa o pretplati.</p>
          )}
        </section>

        <AdjustTokensForm userId={targetUserId} />
        <ImpersonateButton targetUserId={targetUserId} />
      </main>
    </div>
  );
}
