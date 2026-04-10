-- Safety migration: ensure public RPC wrapper exists for Stripe webhook token grants.
create or replace function public.service_grant_tokens(
  p_user_id uuid,
  p_amount_tokens bigint,
  p_reason text,
  p_idempotency_key text default null,
  p_related_generation_id uuid default null,
  p_related_payment_id text default null
)
returns table(granted boolean, new_balance bigint)
language sql
security definer
set search_path = public
as $$
  select * from app.sp_grant_tokens(
    p_user_id,
    p_amount_tokens,
    p_reason,
    p_idempotency_key,
    p_related_generation_id,
    p_related_payment_id
  );
$$;

revoke all on function public.service_grant_tokens(uuid, bigint, text, text, uuid, text) from public;
grant execute on function public.service_grant_tokens(uuid, bigint, text, text, uuid, text) to service_role;
