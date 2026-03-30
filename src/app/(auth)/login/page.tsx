"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field } from "@/components/auth/field";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const authError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(
    authError === "auth_callback"
      ? "Prijava preko linka nije uspela. Pokušaj ponovo."
      : null
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    const safeNext =
      next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    router.push(safeNext);
    router.refresh();
  }

  return (
    <AuthShell
      title="Prijava"
      subtitle="Unesi email i lozinku da uđeš na kontrolnu tablu."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {message ? (
          <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {message}
          </p>
        ) : null}
        <Field
          label="Email"
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={setEmail}
          disabled={loading}
        />
        <Field
          label="Lozinka"
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={setPassword}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
        >
          {loading ? "Šaljem…" : "Prijavi se"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-500">
        <Link href="/forgot-password" className="text-sky-400 hover:underline">
          Zaboravljena lozinka?
        </Link>
      </p>
      <p className="mt-4 text-center text-sm text-zinc-500">
        Nemaš nalog?{" "}
        <Link href="/register" className="font-medium text-sky-400 hover:underline">
          Registracija
        </Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Prijava" subtitle="Učitavanje…">
          <div className="h-32 animate-pulse rounded-lg bg-zinc-900" />
        </AuthShell>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
