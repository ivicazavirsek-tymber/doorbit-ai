-- Dodaje `pro_yearly` u dozvoljene plan_key vrednosti za Stripe tabele.
alter table public.stripe_subscriptions
  drop constraint if exists stripe_subscriptions_plan_key_check;

alter table public.stripe_subscriptions
  add constraint stripe_subscriptions_plan_key_check
  check (plan_key in ('starter_monthly', 'pro_monthly', 'starter_yearly', 'pro_yearly'));

alter table public.checkout_sessions
  drop constraint if exists checkout_sessions_plan_key_check;

alter table public.checkout_sessions
  add constraint checkout_sessions_plan_key_check
  check (plan_key in ('starter_monthly', 'pro_monthly', 'starter_yearly', 'pro_yearly'));
