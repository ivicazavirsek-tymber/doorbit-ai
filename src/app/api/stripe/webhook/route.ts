import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeWebhookSecret } from "@/lib/env";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getStripe } from "@/lib/stripe/server";
import {
  mapStripeSubscriptionStatus,
  syncCheckoutSessionCompletion,
  upsertStripeSubscription,
} from "@/lib/stripe/sync-checkout";
import {
  getTokenGrantForPlan,
  planKeyFromStripePriceId,
} from "@/lib/stripe/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Noviji Invoice objekti nose pretplatu preko `parent.subscription_details`. */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const p = invoice.parent;
  if (p?.type === "subscription_details" && p.subscription_details?.subscription) {
    const s = p.subscription_details.subscription;
    return typeof s === "string" ? s : s.id;
  }
  const anyInv = invoice as unknown as { subscription?: string | Stripe.Subscription | null };
  if (anyInv.subscription) {
    return typeof anyInv.subscription === "string"
      ? anyInv.subscription
      : anyInv.subscription.id;
  }
  return null;
}

async function handleInvoicePaid(
  service: SupabaseClient,
  stripe: Stripe,
  invoice: Stripe.Invoice
) {
  if (invoice.status !== "paid") return;

  const br = invoice.billing_reason;
  if (br !== "subscription_create" && br !== "subscription_cycle") {
    return;
  }

  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (!customerId) return;

  const subId = invoiceSubscriptionId(invoice);
  if (!subId) return;

  const sub = await stripe.subscriptions.retrieve(subId);
  const userIdFromSubMeta =
    typeof sub.metadata?.user_id === "string" ? sub.metadata.user_id : null;

  // U praksi invoice.paid ponekad stigne pre checkout.session.completed.
  // Tada još nema stripe_customers reda; fallback je user_id iz subscription metadata.
  const { data: sc } = await service
    .from("stripe_customers")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  const resolvedUserId = sc?.user_id || userIdFromSubMeta;
  if (!resolvedUserId) {
    console.warn("invoice.paid: cannot resolve user", {
      customerId,
      subscriptionId: sub.id,
    });
    return;
  }

  if (!sc?.user_id) {
    const { error: upErr } = await service.from("stripe_customers").upsert(
      { user_id: resolvedUserId, stripe_customer_id: customerId },
      { onConflict: "user_id" }
    );
    if (upErr) {
      throw new Error(upErr.message);
    }
  }

  const priceId = sub.items.data[0]?.price?.id ?? sub.items.data[0]?.plan?.id;
  if (!priceId) return;

  const planKey = planKeyFromStripePriceId(priceId);
  if (!planKey) {
    console.warn("invoice.paid: unknown price id", priceId);
    return;
  }

  const tokens = getTokenGrantForPlan(planKey);
  const grantIdempotencyKey =
    br === "subscription_create"
      ? `stripe:substart:${sub.id}`
      : `stripe:invoice:${invoice.id}`;
  const { error } = await service.rpc("service_grant_tokens", {
    p_user_id: resolvedUserId,
    p_amount_tokens: tokens,
    p_reason: `stripe:invoice:${invoice.billing_reason}`,
    p_idempotency_key: grantIdempotencyKey,
    p_related_generation_id: null,
    p_related_payment_id: invoice.id,
  });

  if (error) {
    console.error("service_grant_tokens", error);
    throw new Error(error.message);
  }
}

async function handleSubscriptionChange(
  service: SupabaseClient,
  sub: Stripe.Subscription
) {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return;

  const { data: sc } = await service
    .from("stripe_customers")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (!sc?.user_id) return;

  const priceId =
    sub.items.data[0]?.price?.id ??
    (typeof sub.items.data[0]?.plan === "object" && sub.items.data[0]?.plan
      ? sub.items.data[0].plan.id
      : undefined);
  const planKey = priceId ? planKeyFromStripePriceId(priceId) : null;
  if (!planKey) {
    console.warn("subscription change: unknown price", priceId);
    return;
  }

  await upsertStripeSubscription(service, sc.user_id, planKey, sub);
}

export async function POST(request: Request) {
  const secret = getStripeWebhookSecret();
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET missing");
    return new NextResponse("Webhook not configured", { status: 500 });
  }

  const rawBody = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return new NextResponse("Missing stripe-signature", { status: 400 });
  }

  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch {
    return new NextResponse("Stripe not configured", { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (e) {
    console.error("webhook signature", e);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  let service: SupabaseClient;
  try {
    service = createServiceRoleClient();
  } catch {
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  const { data: already } = await service
    .from("stripe_events_idempotency")
    .select("event_id")
    .eq("event_id", event.id)
    .maybeSingle();

  if (already) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await syncCheckoutSessionCompletion(
          service,
          stripe,
          event.data.object as Stripe.Checkout.Session
        );
        break;
      case "invoice.paid":
        await handleInvoicePaid(
          service,
          stripe,
          event.data.object as Stripe.Invoice
        );
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChange(
          service,
          event.data.object as Stripe.Subscription
        );
        break;
      default:
        break;
    }
  } catch (e) {
    console.error("webhook", event.type, e);
    return new NextResponse("Handler error", { status: 500 });
  }

  const { error: insErr } = await service
    .from("stripe_events_idempotency")
    .insert({ event_id: event.id, meta: { type: event.type } });

  if (insErr?.code === "23505") {
    return NextResponse.json({ received: true, duplicate: true });
  }
  if (insErr) {
    console.error("stripe_events_idempotency", insErr);
  }

  return NextResponse.json({ received: true });
}
