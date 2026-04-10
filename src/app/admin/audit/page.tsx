import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";

export default async function AdminAuditPage() {
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

  const { data: rows, error } = await supabase
    .from("admin_audit_logs")
    .select("id, admin_user_id, target_user_id, action_type, meta, created_at")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    return (
      <div className="min-h-full bg-zinc-950 px-6 py-12 text-zinc-100">
        <p className="text-red-400">Ne mogu da učitam audit log.</p>
      </div>
    );
  }

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
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="mt-2 text-sm text-zinc-500">Poslednjih 80 akcija.</p>

        <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="border-b border-zinc-800 bg-zinc-900/50 uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">Vreme</th>
                <th className="px-3 py-2">Akcija</th>
                <th className="px-3 py-2">Admin</th>
                <th className="px-3 py-2">Cilj</th>
                <th className="px-3 py-2">Meta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 font-mono text-zinc-400">
              {(rows ?? []).map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-zinc-500">
                    {new Date(r.created_at).toLocaleString("sr-RS")}
                  </td>
                  <td className="px-3 py-2 text-zinc-200">{r.action_type}</td>
                  <td className="max-w-[120px] truncate px-3 py-2">{r.admin_user_id}</td>
                  <td className="max-w-[120px] truncate px-3 py-2">
                    {r.target_user_id ?? "—"}
                  </td>
                  <td className="max-w-[280px] break-all px-3 py-2 text-[11px]">
                    {r.meta ? JSON.stringify(r.meta) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
