import Link from "next/link";
import { redirect } from "next/navigation";
import { BillingPortalButton } from "@/components/dashboard/billing-button";
import { DashboardGenerations } from "@/components/dashboard/dashboard-generations";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
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

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link href="/" className="text-sm font-medium text-sky-400">
            DoorBit AI
          </Link>
          <nav className="flex items-center gap-4 text-sm text-zinc-400">
            {profile?.role === "admin" ? (
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
        <h1 className="text-2xl font-semibold tracking-tight">Kontrolna tabla</h1>
        <p className="mt-2 text-zinc-400">
          Zdravo,{" "}
          <span className="text-zinc-200">
            {profile?.display_name || user.email}
          </span>
          .
        </p>
        <DashboardGenerations />
        <BillingPortalButton />
      </main>
    </div>
  );
}
