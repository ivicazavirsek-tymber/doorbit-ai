import type { SupabaseClient } from "@supabase/supabase-js";

type ConsumeRow = { consumed: boolean; new_balance: number | string | bigint };

export async function consumeCredits(
  service: SupabaseClient,
  params: {
    userId: string;
    amount: number;
    reason: string;
    idempotencyKey: string;
    relatedGenerationId: string;
  }
): Promise<{ newBalance: number } | { error: string }> {
  const { data, error } = await service.rpc("service_consume_tokens", {
    p_user_id: params.userId,
    p_amount_tokens: params.amount,
    p_reason: params.reason,
    p_idempotency_key: params.idempotencyKey,
    p_related_generation_id: params.relatedGenerationId,
    p_related_payment_id: null,
  });

  if (error) {
    const msg = error.message || String(error);
    if (msg.includes("INSUFFICIENT_TOKENS")) {
      return { error: "INSUFFICIENT_TOKENS" };
    }
    console.error("service_consume_tokens", error);
    return { error: "CONSUME_FAILED" };
  }

  const rows = data as ConsumeRow[] | null;
  const row = Array.isArray(rows) ? rows[0] : (data as ConsumeRow | null);
  if (!row) return { error: "CONSUME_EMPTY" };
  const nb = row.new_balance;
  const num =
    typeof nb === "bigint" ? Number(nb) : typeof nb === "string" ? Number(nb) : nb;
  return { newBalance: num };
}
