import type { SupabaseClient } from "@supabase/supabase-js";

type RateRow = { allowed: boolean; current_count?: number };

export async function checkRateLimitAllowed(
  service: SupabaseClient,
  userId: string,
  routeKey: string,
  limit: number,
  windowMinutes = 1
): Promise<boolean> {
  const { data, error } = await service.rpc("service_check_rate_limit", {
    p_user_id: userId,
    p_route_key: routeKey,
    p_limit: limit,
    p_window_minutes: windowMinutes,
  });

  if (error) {
    console.error("service_check_rate_limit", error);
    return false;
  }

  const rows = data as RateRow[] | null;
  const row = Array.isArray(rows) ? rows[0] : (data as RateRow | null);
  return row?.allowed === true;
}
