import { jsonError, jsonOk, newRequestId } from "@/lib/api/http";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getStripe } from "@/lib/stripe/server";
import { syncCheckoutSessionCompletion } from "@/lib/stripe/sync-checkout";

export async function POST() {
  const requestId = newRequestId();
  const fail = (
    status: number,
    code: string,
    message: string,
    details?: unknown
  ) => jsonError(status, code, message, details, { requestId });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return fail(401, "UNAUTHORIZED", "Prijavi se.");
  }

  let service;
  try {
    service = createServiceRoleClient();
  } catch {
    return fail(500, "SERVER_CONFIG", "Nedostaje SUPABASE_SERVICE_ROLE_KEY.");
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return fail(500, "STRIPE_CONFIG", "Nedostaje STRIPE_SECRET_KEY.");
  }

  const { data: existingSub } = await service
    .from("stripe_subscriptions")
    .select("stripe_subscription_id, plan_key, status")
    .eq("user_id", user.id)
    .order("current_period_end", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (existingSub) {
    return jsonOk({
      synced: false,
      already_present: true,
      subscription_id: existingSub.stripe_subscription_id,
      plan_key: existingSub.plan_key,
      status: existingSub.status,
    });
  }

  const sessions = await stripe.checkout.sessions.list({ limit: 100 });
  const session = sessions.data.find(
    (s) =>
      s.mode === "subscription" &&
      s.status === "complete" &&
      s.payment_status === "paid" &&
      ((s.client_reference_id && s.client_reference_id === user.id) ||
        s.metadata?.user_id === user.id)
  );

  if (!session) {
    return fail(404, "NOT_FOUND", "Ne nalazim uspešan Stripe checkout za ovog korisnika.");
  }

  try {
    const result = await syncCheckoutSessionCompletion(service, stripe, session);
    return jsonOk({
      synced: result.synced,
      session_id: session.id,
      subscription_id: result.subscriptionId,
      plan_key: result.planKey,
    });
  } catch (error) {
    console.error("stripe sync latest", error);
    const message = error instanceof Error ? error.message : "Stripe sync greška.";
    return fail(500, "STRIPE_ERROR", "Ne mogu da uskladim poslednji checkout.", {
      detail: message,
      session_id: session.id,
    });
  }
}
