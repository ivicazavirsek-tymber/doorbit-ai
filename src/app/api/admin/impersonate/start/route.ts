import { cookies } from "next/headers";
import { jsonError, jsonOk, newRequestId } from "@/lib/api/http";
import { IMPERSONATION_SESSION_COOKIE } from "@/lib/admin/impersonation";
import { requireAdminApi } from "@/lib/admin/api-auth";

export async function POST(request: Request) {
  const requestId = newRequestId();
  const ctx = await requireAdminApi();
  if (!ctx) {
    return jsonError(403, "FORBIDDEN", "Nedozvoljeno.", undefined, { requestId });
  }

  const { supabase, user } = ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Telo mora biti JSON.", undefined, {
      requestId,
    });
  }

  const targetRaw =
    body &&
    typeof body === "object" &&
    body !== null &&
    "target_user_id" in body &&
    typeof (body as { target_user_id: unknown }).target_user_id === "string"
      ? (body as { target_user_id: string }).target_user_id.trim()
      : "";

  if (!targetRaw || !/^[0-9a-f-]{36}$/i.test(targetRaw)) {
    return jsonError(400, "INVALID_INPUT", "Nevažeći target_user_id.", undefined, {
      requestId,
    });
  }

  if (targetRaw === user.id) {
    return jsonError(400, "INVALID_INPUT", "Ne možeš pregledati sopstveni nalog.", undefined, {
      requestId,
    });
  }

  const { data: exists } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", targetRaw)
    .maybeSingle();

  if (!exists) {
    return jsonError(404, "NOT_FOUND", "Korisnik nije pronađen.", undefined, {
      requestId,
    });
  }

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const { data: session, error: insErr } = await supabase
    .from("impersonation_sessions")
    .insert({
      admin_user_id: user.id,
      target_user_id: targetRaw,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (insErr || !session) {
    console.error("impersonation_sessions insert", insErr);
    return jsonError(500, "DB_ERROR", "Ne mogu da kreiram sesiju pregleda.", undefined, {
      requestId,
    });
  }

  const { error: auditErr } = await supabase.from("admin_audit_logs").insert({
    admin_user_id: user.id,
    target_user_id: targetRaw,
    action_type: "impersonate_start",
    meta: { expires_at: expiresAt },
  });

  if (auditErr) {
    console.error("admin_audit_logs impersonate_start", auditErr);
    await supabase.from("impersonation_sessions").delete().eq("id", session.id);
    return jsonError(500, "DB_ERROR", "Ne mogu da zabeležim audit.", undefined, {
      requestId,
    });
  }

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 3600,
    secure: process.env.NODE_ENV === "production",
  });

  return jsonOk({ ok: true, session_id: session.id });
}
