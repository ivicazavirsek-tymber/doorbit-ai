import { getEffectiveUserId } from "@/lib/admin/impersonation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonOk, newRequestId } from "@/lib/api/http";
import { getAppBaseUrl } from "@/lib/env";
import { getStripe } from "@/lib/stripe/server";

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

  const effectiveId = await getEffectiveUserId(supabase, user.id);
  if (effectiveId !== user.id) {
    return fail(
      403,
      "FORBIDDEN",
      "Završi pregled korisnika pre Stripe portala."
    );
  }

  const baseUrl = getAppBaseUrl();
  if (!baseUrl) {
    return fail(
      500,
      "STRIPE_CONFIG",
      "Postavi NEXT_PUBLIC_APP_URL za povratak sa Stripe portala."
    );
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
    return fail(
      500,
      "STRIPE_CONFIG",
      "Nedostaje STRIPE_SECRET_KEY_DEV (ili PROD) u .env."
    );
  }

  const { data: row } = await service
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!row?.stripe_customer_id) {
    return fail(
      400,
      "NO_STRIPE_CUSTOMER",
      "Još nemaš Stripe nalog vezan za profil. Prvo odaberi plan na cenovniku."
    );
  }

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: `${baseUrl}/dashboard`,
    });
    if (portal.url) {
      return jsonOk({ url: portal.url });
    }
    return fail(500, "STRIPE_ERROR", "Stripe nije vratio URL portala.");
  } catch (e) {
    console.error("billingPortal.sessions.create", e);
    const msg = e instanceof Error ? e.message : "Stripe greška";
    return fail(502, "STRIPE_ERROR", msg);
  }
}
