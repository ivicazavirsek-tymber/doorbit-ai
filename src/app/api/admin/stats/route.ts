import { jsonError, jsonOk, newRequestId } from "@/lib/api/http";
import { requireAdminApi } from "@/lib/admin/api-auth";

export async function GET() {
  const requestId = newRequestId();
  const ctx = await requireAdminApi();
  if (!ctx) {
    return jsonError(403, "FORBIDDEN", "Nedozvoljeno.", undefined, { requestId });
  }
  const { supabase } = ctx;

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    profilesCount,
    generations24h,
    generationsTotal,
    succeededTotal,
    balanceSum,
  ] = await Promise.all([
    supabase.from("profiles").select("user_id", { count: "exact", head: true }),
    supabase
      .from("ai_generations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since24h),
    supabase.from("ai_generations").select("id", { count: "exact", head: true }),
    supabase
      .from("ai_generations")
      .select("id", { count: "exact", head: true })
      .eq("status", "succeeded"),
    supabase.from("credit_balances").select("balance_tokens"),
  ]);

  const errors = [
    profilesCount.error,
    generations24h.error,
    generationsTotal.error,
    succeededTotal.error,
    balanceSum.error,
  ].filter(Boolean);
  if (errors.length) {
    console.error("admin stats", errors);
    return jsonError(500, "DB_ERROR", "Ne mogu da učitam statistiku.", undefined, {
      requestId,
    });
  }

  let total_tokens_in_balances = 0;
  for (const row of balanceSum.data ?? []) {
    const b = row as { balance_tokens: number };
    total_tokens_in_balances += Number(b.balance_tokens) || 0;
  }

  return jsonOk({
    user_count: profilesCount.count ?? 0,
    generations_last_24h: generations24h.count ?? 0,
    generations_total: generationsTotal.count ?? 0,
    generations_succeeded_total: succeededTotal.count ?? 0,
    total_tokens_in_balances,
  });
}
