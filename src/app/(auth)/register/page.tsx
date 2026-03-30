"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field } from "@/components/auth/field";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const origin = window.location.origin;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
      },
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
        title="Proveri email"
        subtitle="Poslali smo ti link za potvrdu naloga. Kad potvrdiš, možeš da se prijaviš."
      >
        <p className="text-sm text-zinc-400">
          Ako ne vidiš poruku, proveri spam folder.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-sky-400 hover:underline"
        >
          Nazad na prijavu
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Registracija"
      subtitle="Napravi nalog za DoorBit AI."
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
          autoComplete="new-password"
          required
          value={password}
          onChange={setPassword}
          disabled={loading}
        />
        <p className="text-xs text-zinc-500">
          Minimum dužine zavisi od podešavanja u Supabase (obično 6 karaktera).
        </p>
        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
        >
          {loading ? "Šaljem…" : "Registruj se"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-500">
        Već imaš nalog?{" "}
        <Link href="/login" className="font-medium text-sky-400 hover:underline">
          Prijava
        </Link>
      </p>
    </AuthShell>
  );
}
