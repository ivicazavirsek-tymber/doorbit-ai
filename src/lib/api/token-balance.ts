import type { SupabaseClient } from "@supabase/supabase-js";

export async function getTokenBalance(
  supabase: SupabaseClient,
  userId: string
): Promise<number | null> {
  const { data, error } = await supabase
    .from("credit_balances")
    .select("balance_tokens")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  const v = data.balance_tokens;
  return typeof v === "bigint" ? Number(v) : Number(v);
}
