"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field } from "@/components/auth/field";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [sessionOk, setSessionOk] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setMessage("Link je istekao ili nije validan. Zatraži novi email za reset.");
      } else {
        setSessionOk(true);
      }
      setReady(true);
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setMessage("Lozinke se ne poklapaju.");
      return;
    }
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  if (!ready) {
    return <AuthShell title="Nova lozinka" subtitle="Učitavanje…" />;
  }

  if (!sessionOk) {
    return (
      <AuthShell title="Nova lozinka" subtitle="Sesija nije pronađena.">
        {message ? (
          <p className="rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
            {message}
          </p>
        ) : null}
        <Link
          href="/forgot-password"
          className="mt-6 inline-block text-sm font-medium text-sky-400 hover:underline"
        >
          Zatraži novi link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Nova lozinka"
      subtitle="Unesi novu lozinku za svoj nalog."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {message ? (
          <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {message}
          </p>
        ) : null}
        <Field
          label="Nova lozinka"
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={setPassword}
          disabled={loading}
        />
        <Field
          label="Potvrdi lozinku"
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={setConfirm}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
        >
          {loading ? "Čuvam…" : "Sačuvaj lozinku"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-500">
        <Link href="/login" className="text-sky-400 hover:underline">
          Nazad na prijavu
        </Link>
      </p>
    </AuthShell>
  );
}
