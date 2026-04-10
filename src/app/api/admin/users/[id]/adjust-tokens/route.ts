import { jsonError, jsonOk, newRequestId } from "@/lib/api/http";
import { requireAdminApi } from "@/lib/admin/api-auth";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteCtx) {
  const requestId = newRequestId();
  const adminCtx = await requireAdminApi();
  if (!adminCtx) {
    return jsonError(403, "FORBIDDEN", "Nedozvoljeno.", undefined, { requestId });
  }

  const { id: targetUserId } = await ctx.params;
  if (!targetUserId || !/^[0-9a-f-]{36}$/i.test(targetUserId)) {
    return jsonError(400, "INVALID_INPUT", "Nevažeći korisnik.", undefined, {
      requestId,
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Telo mora biti JSON.", undefined, {
      requestId,
    });
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return jsonError(400, "INVALID_JSON", "Telo mora biti JSON objekat.", undefined, {
      requestId,
    });
  }

  const obj = body as Record<string, unknown>;
  const deltaRaw = obj.delta;
  const reasonRaw = obj.reason;

  if (typeof deltaRaw !== "number" || !Number.isFinite(deltaRaw)) {
    return jsonError(400, "INVALID_INPUT", "Polje delta mora biti broj.", undefined, {
      requestId,
    });
  }
  const delta = Math.trunc(deltaRaw);
  if (delta === 0) {
    return jsonError(400, "INVALID_INPUT", "delta ne sme biti 0.", undefined, {
      requestId,
    });
  }

  if (typeof reasonRaw !== "string" || reasonRaw.trim().length < 2) {
    return jsonError(400, "INVALID_INPUT", "Razlog mora imati bar 2 karaktera.", undefined, {
      requestId,
    });
  }

  const { supabase } = adminCtx;

  const { data: rpcData, error: rpcErr } = await supabase.rpc("admin_adjust_tokens", {
    p_target_user_id: targetUserId,
    p_delta: delta,
    p_reason: reasonRaw.trim(),
  });

  if (rpcErr) {
    console.error("admin_adjust_tokens", rpcErr);
    const msg = rpcErr.message.toLowerCase();
    if (msg.includes("insufficient_tokens")) {
      return jsonError(
        400,
        "INSUFFICIENT_TOKENS",
        "Korisnik nema dovoljno tokena za ovo skidanje.",
        undefined,
        { requestId }
      );
    }
    if (msg.includes("forbidden")) {
      return jsonError(403, "FORBIDDEN", "Nedozvoljeno.", undefined, { requestId });
    }
    return jsonError(500, "DB_ERROR", "Ne mogu da ažuriram tokene.", undefined, {
      requestId,
    });
  }

  const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  const newBalance =
    row && typeof row === "object" && "new_balance" in row
      ? Number((row as { new_balance: unknown }).new_balance)
      : null;

  return jsonOk({
    new_balance: newBalance,
  });
}
