import { cookies } from "next/headers";
import { jsonError, jsonOk, newRequestId } from "@/lib/api/http";
import { IMPERSONATION_SESSION_COOKIE } from "@/lib/admin/impersonation";
import { requireAdminApi } from "@/lib/admin/api-auth";

export async function POST() {
  const requestId = newRequestId();
  const ctx = await requireAdminApi();
  if (!ctx) {
    return jsonError(403, "FORBIDDEN", "Nedozvoljeno.", undefined, { requestId });
  }

  const { supabase, user } = ctx;
  const cookieStore = await cookies();
  const sid = cookieStore.get(IMPERSONATION_SESSION_COOKIE)?.value;

  if (!sid) {
    return jsonOk({ ok: true });
  }

  const { data: row } = await supabase
    .from("impersonation_sessions")
    .select("target_user_id")
    .eq("id", sid)
    .eq("admin_user_id", user.id)
    .maybeSingle();

  await supabase
    .from("impersonation_sessions")
    .delete()
    .eq("id", sid)
    .eq("admin_user_id", user.id);

  cookieStore.delete(IMPERSONATION_SESSION_COOKIE);

  if (row?.target_user_id) {
    const { error: auditErr } = await supabase.from("admin_audit_logs").insert({
      admin_user_id: user.id,
      target_user_id: row.target_user_id,
      action_type: "impersonate_end",
      meta: {},
    });
    if (auditErr) {
      console.error("admin_audit_logs impersonate_end", auditErr);
    }
  }

  return jsonOk({ ok: true });
}
