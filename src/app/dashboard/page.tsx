import Link from "next/link";
import { redirect } from "next/navigation";
import { ImpersonationBanner } from "@/components/admin/impersonation-banner";
import { BillingPortalButton } from "@/components/dashboard/billing-button";
import { DashboardGenerations } from "@/components/dashboard/dashboard-generations";
import { StripeCheckoutSync } from "@/components/dashboard/stripe-checkout-sync";
import { SubscriptionStatusCard } from "@/components/dashboard/subscription-status";
import { SignOutButton } from "@/components/sign-out-button";
import { getEffectiveUserId } from "@/lib/admin/impersonation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const effectiveId = await getEffectiveUserId(supabase, user.id);
  const isImpersonating = effectiveId !== user.id;

  let impersonationEmail: string | null = null;
  if (isImpersonating) {
    try {
      const svc = createServiceRoleClient();
      const { data } = await svc.auth.admin.getUserById(effectiveId);
      impersonationEmail = data.user?.email ?? null;
    } catch {
      impersonationEmail = null;
    }
  }

  const { data: jwtProfile } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: viewProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", effectiveId)
    .maybeSingle();

  const { data: sub } = await supabase
    .from("stripe_subscriptions")
    .select("plan_key, status, cancel_at_period_end, current_period_end")
    .eq("user_id", effectiveId)
    .order("current_period_end", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const greetingName =
    viewProfile?.display_name?.trim() ||
    (isImpersonating ? impersonationEmail : null) ||
    user.email;
  const params = (await searchParams) ?? {};
  const stripeSuccess = params.stripe === "success";

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link href="/" className="text-sm font-medium text-sky-400">
            DoorBit AI
          </Link>
          <nav className="flex items-center gap-4 text-sm text-zinc-400">
            {jwtProfile?.role === "admin" ? (
              <Link href="/admin" className="hover:text-zinc-200">
                Admin
              </Link>
            ) : null}
            <Link href="/pricing" className="hover:text-zinc-200">
              Cenovnik
            </Link>
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <StripeCheckoutSync enabled={!isImpersonating && stripeSuccess} />
        {isImpersonating && impersonationEmail ? (
          <ImpersonationBanner targetEmail={impersonationEmail} />
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight">Kontrolna tabla</h1>
        <p className="mt-2 text-zinc-400">
          Zdravo,{" "}
          <span className="text-zinc-200">{greetingName}</span>
          .
        </p>
        <SubscriptionStatusCard
          planKey={sub?.plan_key ?? null}
          status={sub?.status ?? null}
          cancelAtPeriodEnd={sub?.cancel_at_period_end ?? null}
          currentPeriodEnd={sub?.current_period_end ?? null}
        />
        <section className="mt-10 rounded-xl border border-zinc-800/80 bg-zinc-900/25 p-5">
          <h2 className="text-sm font-medium text-zinc-300">Šta možeš ovde</h2>
          <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-zinc-500">
            <li>
              <span className="text-zinc-400">Slika iz tekstualnog opisa</span> ili{" "}
              <span className="text-zinc-400">iz otpremljene fotografije</span> — za
              vizuelne predloge.
            </li>
            <li>
              <span className="text-zinc-400">Marketing copy</span> po tvom briefu
              (opciono sa slikom).
            </li>
            <li>
              Istorija generacija i stanje tokena ispod; pretplatom upravljaš sa{" "}
              <Link href="/pricing" className="text-sky-400 hover:text-sky-300">
                cenovnika
              </Link>{" "}
              ili dugmetom za Stripe portal.
            </li>
          </ul>
        </section>
        <DashboardGenerations />
        <BillingPortalButton hidden={isImpersonating} />
      </main>
    </div>
  );
}
