import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeWebhookSecret } from "@/lib/env";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getStripe } from "@/lib/stripe/server";
import {
  getTokenGrantForPlan,
  isStripePlanKey,
  planKeyFromStripePriceId,
  type StripePlanKey,
} from "@/lib/stripe/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function subscriptionPeriodBounds(sub: Stripe.Subscription): {
  start: number;
  end: number;
} {
  const item = sub.items?.data?.[0];
  if (item?.current_period_start != null && item?.current_period_end != null) {
    return {
      start: item.current_period_start,
      end: item.current_period_end,
    };
  }
  const sd = sub.start_date ?? sub.created;
  return { start: sd, end: sd };
}

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

function mapStripeSubscriptionStatus(
  s: Stripe.Subscription.Status
): "active" | "trialing" | "past_due" | "canceled" | "incomplete" {
  switch (s) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "unpaid":
      return "past_due";
    case "paused":
      return "active";
    case "incomplete":
    case "incomplete_expired":
    default:
      return "incomplete";
  }
}

async function upsertStripeSubscription(
  service: SupabaseClient,
  userId: string,
  planKey: StripePlanKey,
  sub: Stripe.Subscription
) {
  const { start, end } = subscriptionPeriodBounds(sub);
  const { error } = await service.from("stripe_subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: sub.id,
      plan_key: planKey,
      status: mapStripeSubscriptionStatus(sub.status),
      current_period_start: new Date(start * 1000).toISOString(),
      current_period_end: new Date(end * 1000).toISOString(),
      cancel_at_period_end: sub.cancel_at_period_end,
    },
    { onConflict: "stripe_subscription_id" }
  );
  if (error) throw new Error(error.message);
}

async function handleCheckoutSessionCompleted(
  service: SupabaseClient,
  stripe: Stripe,
  session: Stripe.Checkout.Session
) {
  if (session.mode !== "subscription") return;

  const userId = session.metadata?.user_id;
  const planKeyRaw = session.metadata?.plan_key;
  if (!userId || !planKeyRaw || !isStripePlanKey(planKeyRaw)) {
    console.warn("checkout.session.completed: missing metadata", session.id);
    return;
  }
  const planKey = planKeyRaw as StripePlanKey;

  const customerId =
    typeof session.customer === "string" ? session.customer : null;
  const subId =
    typeof session.subscription === "string" ? session.subscription : null;
  if (!customerId || !subId) return;

  const { error: cErr } = await service.from("stripe_customers").upsert(
    { user_id: userId, stripe_customer_id: customerId },
    { onConflict: "user_id" }
  );
  if (cErr) throw new Error(cErr.message);

  const { error: chErr } = await service.from("checkout_sessions").upsert(
    {
      user_id: userId,
      stripe_checkout_session_id: session.id,
      plan_key: planKey,
      status: "completed",
    },
    { onConflict: "stripe_checkout_session_id" }
  );
  if (chErr) throw new Error(chErr.message);

  const sub = await stripe.subscriptions.retrieve(subId);
  await upsertStripeSubscription(service, userId, planKey, sub);
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

  const { data: sc } = await service
    .from("stripe_customers")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (!sc?.user_id) {
    console.warn("invoice.paid: no stripe_customers row", customerId);
    return;
  }

  const subId = invoiceSubscriptionId(invoice);
  if (!subId) return;

  const sub = await stripe.subscriptions.retrieve(subId);
  const priceId = sub.items.data[0]?.price?.id ?? sub.items.data[0]?.plan?.id;
  if (!priceId) return;

  const planKey = planKeyFromStripePriceId(priceId);
  if (!planKey) {
    console.warn("invoice.paid: unknown price id", priceId);
    return;
  }

  const tokens = getTokenGrantForPlan(planKey);
  const { error } = await service.rpc("service_grant_tokens", {
    p_user_id: sc.user_id,
    p_amount_tokens: tokens,
    p_reason: `stripe:invoice:${invoice.billing_reason}`,
    p_idempotency_key: `stripe:invoice:${invoice.id}`,
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
        await handleCheckoutSessionCompleted(
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
