-- PostgREST exposes public schema; app.* funkcije nisu dostupne preko supabase-js.
-- Ovi wrapperi se pozivaju samo sa service_role ključem.

create or replace function public.service_check_rate_limit(
  p_user_id uuid,
  p_route_key text,
  p_limit integer,
  p_window_minutes integer default 1
)
returns table(allowed boolean, current_count integer, window_start timestamptz)
language sql
security definer
set search_path = public
as $$
  select * from app.sp_check_rate_limit(
    p_user_id,
    p_route_key,
    p_limit,
    p_window_minutes
  );
$$;

revoke all on function public.service_check_rate_limit(uuid, text, integer, integer) from public;
grant execute on function public.service_check_rate_limit(uuid, text, integer, integer) to service_role;

create or replace function public.service_consume_tokens(
  p_user_id uuid,
  p_amount_tokens bigint,
  p_reason text,
  p_idempotency_key text default null,
  p_related_generation_id uuid default null,
  p_related_payment_id text default null
)
returns table(consumed boolean, new_balance bigint)
language sql
security definer
set search_path = public
as $$
  select * from app.sp_consume_tokens(
    p_user_id,
    p_amount_tokens,
    p_reason,
    p_idempotency_key,
    p_related_generation_id,
    p_related_payment_id
  );
$$;

revoke all on function public.service_consume_tokens(uuid, bigint, text, text, uuid, text) from public;
grant execute on function public.service_consume_tokens(uuid, bigint, text, text, uuid, text) to service_role;
