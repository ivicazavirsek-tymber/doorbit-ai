import { getEffectiveUserId } from "@/lib/admin/impersonation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonOk, newRequestId } from "@/lib/api/http";
import { getAppBaseUrl } from "@/lib/env";
import { getStripe } from "@/lib/stripe/server";
import {
  getStripePriceId,
  isStripePlanKey,
  type StripePlanKey,
} from "@/lib/stripe/plans";

export async function POST(request: Request) {
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
      "Završi pregled korisnika pre kupovine pretplate."
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "INVALID_JSON", "Telo mora biti JSON.");
  }

  const planKeyRaw =
    typeof (body as { plan_key?: unknown })?.plan_key === "string"
      ? (body as { plan_key: string }).plan_key.trim()
      : "";
  if (!isStripePlanKey(planKeyRaw)) {
    return fail(400, "INVALID_INPUT", "Nepoznat plan_key.", {
      allowed: ["starter_monthly", "pro_monthly", "starter_yearly", "pro_yearly"],
    });
  }
  const planKey = planKeyRaw as StripePlanKey;

  const priceId = getStripePriceId(planKey);
  if (!priceId) {
    return fail(
      500,
      "STRIPE_CONFIG",
      "Nedostaje Stripe Price ID za ovaj plan u .env (STRIPE_PRICE_*_ID_DEV ili _PROD)."
    );
  }

  const baseUrl = getAppBaseUrl();
  if (!baseUrl) {
    return fail(
      500,
      "STRIPE_CONFIG",
      "Postavi NEXT_PUBLIC_APP_URL (npr. http://localhost:3000) za redirect nakon uplate."
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

  const { data: existing } = await service
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let customerId = existing?.stripe_customer_id ?? null;

  if (!customerId) {
    const stripeCustomer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    });
    customerId = stripeCustomer.id;
    const { error: upErr } = await service.from("stripe_customers").upsert(
      {
        user_id: user.id,
        stripe_customer_id: customerId,
      },
      { onConflict: "user_id" }
    );
    if (upErr) {
      console.error("stripe_customers upsert", upErr);
      return fail(500, "DB_ERROR", "Ne mogu da sačuvam Stripe korisnika.");
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard?stripe=success`,
      cancel_url: `${baseUrl}/pricing?stripe=canceled`,
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        plan_key: planKey,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_key: planKey,
        },
      },
    });

    if (session.url) {
      return jsonOk({ url: session.url });
    }
    return fail(500, "STRIPE_ERROR", "Stripe nije vratio URL za checkout.");
  } catch (e) {
    console.error("stripe.checkout.sessions.create", e);
    const msg = e instanceof Error ? e.message : "Stripe greška";
    return fail(502, "STRIPE_ERROR", msg);
  }
}
