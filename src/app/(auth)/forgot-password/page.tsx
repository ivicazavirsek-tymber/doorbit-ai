"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field } from "@/components/auth/field";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const origin = window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <AuthShell
        title="Email poslat"
        subtitle="Ako nalog postoji, uskoro ćeš dobiti link za reset lozinke."
      >
        <Link
          href="/login"
          className="inline-block text-sm font-medium text-sky-400 hover:underline"
        >
          Nazad na prijavu
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset lozinke"
      subtitle="Unesi email — poslaćemo ti link za novu lozinku."
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
        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
        >
          {loading ? "Šaljem…" : "Pošalji link"}
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
