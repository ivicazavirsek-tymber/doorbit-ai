import { jsonError, jsonOk, newRequestId } from "@/lib/api/http";
import { requireAdminApi } from "@/lib/admin/api-auth";
import { createServiceRoleClient } from "@/lib/supabase/service";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
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

  let service;
  try {
    service = createServiceRoleClient();
  } catch {
    return jsonError(
      500,
      "SERVER_CONFIG",
      "Nedostaje SUPABASE_SERVICE_ROLE_KEY na serveru.",
      undefined,
      { requestId }
    );
  }

  const { data: authUser, error: authErr } =
    await service.auth.admin.getUserById(targetUserId);
  if (authErr || !authUser.user) {
    return jsonError(404, "NOT_FOUND", "Korisnik nije pronađen.", undefined, {
      requestId,
    });
  }

  const { supabase } = adminCtx;

  const [{ data: profile }, { data: balance }, { data: subs }, { data: onboarding }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", targetUserId).maybeSingle(),
      supabase
        .from("credit_balances")
        .select("balance_tokens, updated_at")
        .eq("user_id", targetUserId)
        .maybeSingle(),
      supabase
        .from("stripe_subscriptions")
        .select(
          "plan_key, status, cancel_at_period_end, current_period_end, stripe_subscription_id"
        )
        .eq("user_id", targetUserId)
        .order("current_period_end", { ascending: false, nullsFirst: false }),
      supabase
        .from("user_onboarding")
        .select("industry, main_city, website")
        .eq("user_id", targetUserId)
        .maybeSingle(),
    ]);

  const { count: genCount } = await supabase
    .from("ai_generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", targetUserId);

  return jsonOk({
    user_id: targetUserId,
    email: authUser.user.email ?? null,
    email_confirmed_at: authUser.user.email_confirmed_at ?? null,
    profile: profile ?? null,
    balance_tokens: balance?.balance_tokens ?? null,
    balance_updated_at: balance?.updated_at ?? null,
    subscriptions: subs ?? [],
    onboarding: onboarding ?? null,
    generations_total: genCount ?? 0,
  });
}
