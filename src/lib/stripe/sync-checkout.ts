import type { SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import {
  getTokenGrantForPlan,
  isStripePlanKey,
  type StripePlanKey,
} from "@/lib/stripe/plans";

export function mapStripeSubscriptionStatus(
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

export async function upsertStripeSubscription(
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

export async function syncCheckoutSessionCompletion(
  service: SupabaseClient,
  stripe: Stripe,
  session: Stripe.Checkout.Session
) {
  if (session.mode !== "subscription") return { synced: false as const };

  const userId = session.metadata?.user_id;
  const planKeyRaw = session.metadata?.plan_key;
  if (!userId || !planKeyRaw || !isStripePlanKey(planKeyRaw)) {
    throw new Error("CHECKOUT_METADATA_MISSING");
  }
  const planKey = planKeyRaw as StripePlanKey;

  const customerId =
    typeof session.customer === "string" ? session.customer : null;
  const subId =
    typeof session.subscription === "string" ? session.subscription : null;
  if (!customerId || !subId) {
    throw new Error("CHECKOUT_LINKS_MISSING");
  }

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

  const subStatus = mapStripeSubscriptionStatus(sub.status);
  if (subStatus === "active" || subStatus === "trialing" || subStatus === "past_due") {
    const tokens = getTokenGrantForPlan(planKey);
    const { error: gErr } = await service.rpc("service_grant_tokens", {
      p_user_id: userId,
      p_amount_tokens: tokens,
      p_reason: "stripe:checkout:subscription_create",
      p_idempotency_key: `stripe:substart:${sub.id}`,
      p_related_generation_id: null,
      p_related_payment_id: session.id,
    });
    if (gErr) {
      throw new Error(gErr.message);
    }
  }

  return {
    synced: true as const,
    userId,
    planKey,
    subscriptionId: sub.id,
  };
}
