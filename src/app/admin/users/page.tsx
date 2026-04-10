import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

export default async function AdminUsersPage() {
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

  const { data: listData, error: listErr } = await service.auth.admin.listUsers({
    page: 1,
    perPage: 100,
  });

  if (listErr) {
    return (
      <div className="min-h-full bg-zinc-950 px-6 py-12 text-zinc-100">
        <p className="text-red-400">Ne mogu da učitam korisnike.</p>
      </div>
    );
  }

  const users = listData.users ?? [];
  const ids = users.map((u) => u.id);

  const { data: profiles } =
    ids.length === 0
      ? { data: [] as { user_id: string; display_name: string; role: string }[] }
      : await supabase
          .from("profiles")
          .select("user_id, display_name, role")
          .in("user_id", ids);

  const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <Link href="/admin" className="text-sm font-medium text-sky-400">
            ← Admin
          </Link>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Korisnici</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Lista iz Supabase Auth (prva stranica, do 100). Za detalje klikni red.
        </p>

        <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-900/50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Ime</th>
                <th className="px-4 py-3">Uloga</th>
                <th className="px-4 py-3">Poslednja prijava</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {users.map((u) => {
                const p = byId.get(u.id);
                return (
                  <tr key={u.id} className="hover:bg-zinc-900/40">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="text-sky-400 hover:text-sky-300"
                      >
                        {u.email ?? u.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {p?.display_name || "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{p?.role ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-500">
                      {u.last_sign_in_at
                        ? new Date(u.last_sign_in_at).toLocaleString("sr-RS")
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
