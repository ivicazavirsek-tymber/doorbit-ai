-- DoorBit AI initial database schema
-- Phase 3: tables, relations, RLS, SQL functions, storage buckets

create extension if not exists pgcrypto;

create schema if not exists app;

create type app.app_role as enum ('user', 'admin');
create type app.generation_type as enum ('image_from_photo', 'copy_from_optional_image', 'image_from_text');
create type app.generation_status as enum ('pending', 'succeeded', 'failed');
create type app.subscription_status as enum ('active', 'trialing', 'past_due', 'canceled', 'incomplete');
create type app.credit_ledger_direction as enum ('credit', 'debit');
create type app.admin_action_type as enum (
  'impersonate_start',
  'impersonate_end',
  'token_adjust',
  'user_view',
  'user_update',
  'subscription_update'
);

create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role app.app_role not null default 'user',
  display_name text not null default '',
  business_name text,
  onboarding_completed boolean not null default false,
  brand_tone text,
  social_platforms text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_onboarding (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  industry text,
  website text,
  main_city text,
  door_styles text[],
  value_proposition text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  type text not null check (type in ('logo')),
  storage_bucket text not null,
  storage_path text not null,
  public_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.credit_balances (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  balance_tokens bigint not null default 0 check (balance_tokens >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  direction app.credit_ledger_direction not null,
  amount_tokens bigint not null check (amount_tokens > 0),
  reason text not null,
  related_generation_id uuid,
  related_payment_id text,
  idempotency_key text,
  created_at timestamptz not null default now()
);

create unique index if not exists credit_ledger_user_idempotency_key_uq
  on public.credit_ledger (user_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.api_rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  route_key text not null,
  minute_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now()
);

create unique index if not exists api_rate_limit_events_unique
  on public.api_rate_limit_events (user_id, route_key, minute_start);

create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  generation_type app.generation_type not null,
  status app.generation_status not null default 'pending',
  credits_cost integer not null check (credits_cost > 0),
  idempotency_key text,
  input_image_storage_path text,
  input_text_prompt text,
  output_image_storage_path text,
  output_text text,
  ai_provider text not null check (ai_provider in ('openai', 'gemini')),
  ai_model text not null,
  error_message text,
  request_meta jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ai_generations_user_created_idx
  on public.ai_generations (user_id, created_at desc);

create unique index if not exists ai_generations_user_type_idempotency_uq
  on public.ai_generations (user_id, generation_type, idempotency_key)
  where idempotency_key is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'credit_ledger_related_generation_fk'
  ) then
    alter table public.credit_ledger
      add constraint credit_ledger_related_generation_fk
      foreign key (related_generation_id) references public.ai_generations(id) on delete set null
      deferrable initially deferred;
  end if;
end
$$;

create table if not exists public.stripe_customers (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.stripe_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  stripe_subscription_id text not null unique,
  plan_key text not null check (plan_key in ('starter_monthly', 'pro_monthly', 'starter_yearly')),
  status app.subscription_status not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stripe_events_idempotency (
  event_id text primary key,
  processed_at timestamptz not null default now(),
  meta jsonb
);

create table if not exists public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  stripe_checkout_session_id text not null unique,
  plan_key text not null check (plan_key in ('starter_monthly', 'pro_monthly', 'starter_yearly')),
  status text not null check (status in ('created', 'completed', 'expired')),
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles(user_id) on delete cascade,
  target_user_id uuid references public.profiles(user_id) on delete set null,
  action_type app.admin_action_type not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_admin_created_idx
  on public.admin_audit_logs (admin_user_id, created_at desc);

create table if not exists public.impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles(user_id) on delete cascade,
  target_user_id uuid not null references public.profiles(user_id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists impersonation_sessions_target_idx
  on public.impersonation_sessions (target_user_id, expires_at desc);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function app.set_updated_at();

create trigger user_onboarding_set_updated_at
before update on public.user_onboarding
for each row execute function app.set_updated_at();

create trigger credit_balances_set_updated_at
before update on public.credit_balances
for each row execute function app.set_updated_at();

create trigger stripe_subscriptions_set_updated_at
before update on public.stripe_subscriptions
for each row execute function app.set_updated_at();

create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (user_id) do nothing;

  insert into public.credit_balances (user_id, balance_tokens)
  values (new.id, 0)
  on conflict (user_id) do nothing;

  insert into public.user_onboarding (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function app.handle_new_user();

create or replace function app.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'
  );
$$;

create or replace function app.sp_grant_tokens(
  p_user_id uuid,
  p_amount_tokens bigint,
  p_reason text,
  p_idempotency_key text default null,
  p_related_generation_id uuid default null,
  p_related_payment_id text default null
)
returns table(granted boolean, new_balance bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing record;
begin
  if p_amount_tokens <= 0 then
    raise exception 'INVALID_TOKEN_AMOUNT';
  end if;

  if p_idempotency_key is not null then
    select l.id into v_existing
    from public.credit_ledger l
    where l.user_id = p_user_id
      and l.idempotency_key = p_idempotency_key
    limit 1;

    if found then
      return query
      select true, b.balance_tokens
      from public.credit_balances b
      where b.user_id = p_user_id;
      return;
    end if;
  end if;

  insert into public.credit_balances (user_id, balance_tokens)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  update public.credit_balances
  set balance_tokens = balance_tokens + p_amount_tokens,
      updated_at = now()
  where user_id = p_user_id;

  insert into public.credit_ledger (
    user_id,
    direction,
    amount_tokens,
    reason,
    related_generation_id,
    related_payment_id,
    idempotency_key
  )
  values (
    p_user_id,
    'credit',
    p_amount_tokens,
    p_reason,
    p_related_generation_id,
    p_related_payment_id,
    p_idempotency_key
  );

  return query
  select true, b.balance_tokens
  from public.credit_balances b
  where b.user_id = p_user_id;
end;
$$;

create or replace function app.sp_consume_tokens(
  p_user_id uuid,
  p_amount_tokens bigint,
  p_reason text,
  p_idempotency_key text default null,
  p_related_generation_id uuid default null,
  p_related_payment_id text default null
)
returns table(consumed boolean, new_balance bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
begin
  if p_amount_tokens <= 0 then
    raise exception 'INVALID_TOKEN_AMOUNT';
  end if;

  if p_idempotency_key is not null and exists (
    select 1
    from public.credit_ledger l
    where l.user_id = p_user_id
      and l.idempotency_key = p_idempotency_key
  ) then
    return query
    select true, b.balance_tokens
    from public.credit_balances b
    where b.user_id = p_user_id;
    return;
  end if;

  select b.balance_tokens
  into v_balance
  from public.credit_balances b
  where b.user_id = p_user_id
  for update;

  if v_balance is null then
    raise exception 'NO_BALANCE_ROW';
  end if;

  if v_balance < p_amount_tokens then
    raise exception 'INSUFFICIENT_TOKENS';
  end if;

  update public.credit_balances
  set balance_tokens = balance_tokens - p_amount_tokens,
      updated_at = now()
  where user_id = p_user_id;

  insert into public.credit_ledger (
    user_id,
    direction,
    amount_tokens,
    reason,
    related_generation_id,
    related_payment_id,
    idempotency_key
  )
  values (
    p_user_id,
    'debit',
    p_amount_tokens,
    p_reason,
    p_related_generation_id,
    p_related_payment_id,
    p_idempotency_key
  );

  return query
  select true, b.balance_tokens
  from public.credit_balances b
  where b.user_id = p_user_id;
end;
$$;

create or replace function app.sp_check_rate_limit(
  p_user_id uuid,
  p_route_key text,
  p_limit integer,
  p_window_minutes integer default 1
)
returns table(allowed boolean, current_count integer, window_start timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
  v_window_seconds integer;
begin
  if p_limit <= 0 then
    raise exception 'INVALID_RATE_LIMIT';
  end if;

  if p_window_minutes <= 0 then
    raise exception 'INVALID_RATE_WINDOW';
  end if;

  v_window_seconds := p_window_minutes * 60;
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / v_window_seconds) * v_window_seconds
  );

  insert into public.api_rate_limit_events (user_id, route_key, minute_start, count)
  values (p_user_id, p_route_key, v_window_start, 1)
  on conflict (user_id, route_key, minute_start)
  do update set count = public.api_rate_limit_events.count + 1, updated_at = now()
  returning count into v_count;

  if v_count > p_limit then
    return query select false, v_count, v_window_start;
    return;
  end if;

  return query select true, v_count, v_window_start;
end;
$$;

alter table public.profiles enable row level security;
alter table public.user_onboarding enable row level security;
alter table public.brand_assets enable row level security;
alter table public.credit_balances enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.api_rate_limit_events enable row level security;
alter table public.ai_generations enable row level security;
alter table public.stripe_customers enable row level security;
alter table public.stripe_subscriptions enable row level security;
alter table public.stripe_events_idempotency enable row level security;
alter table public.checkout_sessions enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.impersonation_sessions enable row level security;

create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (user_id = auth.uid() or app.is_admin());

create policy "profiles_insert_self_or_admin"
  on public.profiles for insert
  with check (user_id = auth.uid() or app.is_admin());

create policy "profiles_update_own_or_admin"
  on public.profiles for update
  using (user_id = auth.uid() or app.is_admin())
  with check (user_id = auth.uid() or app.is_admin());

create policy "user_onboarding_all_own_or_admin"
  on public.user_onboarding for all
  using (user_id = auth.uid() or app.is_admin())
  with check (user_id = auth.uid() or app.is_admin());

create policy "brand_assets_all_own_or_admin"
  on public.brand_assets for all
  using (user_id = auth.uid() or app.is_admin())
  with check (user_id = auth.uid() or app.is_admin());

create policy "credit_balances_select_own_or_admin"
  on public.credit_balances for select
  using (user_id = auth.uid() or app.is_admin());

create policy "credit_ledger_select_own_or_admin"
  on public.credit_ledger for select
  using (user_id = auth.uid() or app.is_admin());

create policy "api_rate_limit_events_select_own_or_admin"
  on public.api_rate_limit_events for select
  using (user_id = auth.uid() or app.is_admin());

create policy "ai_generations_all_own_or_admin"
  on public.ai_generations for all
  using (user_id = auth.uid() or app.is_admin())
  with check (user_id = auth.uid() or app.is_admin());

create policy "stripe_customers_select_own_or_admin"
  on public.stripe_customers for select
  using (user_id = auth.uid() or app.is_admin());

create policy "stripe_subscriptions_select_own_or_admin"
  on public.stripe_subscriptions for select
  using (user_id = auth.uid() or app.is_admin());

create policy "checkout_sessions_select_own_or_admin"
  on public.checkout_sessions for select
  using (user_id = auth.uid() or app.is_admin());

create policy "admin_audit_logs_admin_only"
  on public.admin_audit_logs for select
  using (app.is_admin());

create policy "admin_audit_logs_insert_admin_only"
  on public.admin_audit_logs for insert
  with check (app.is_admin());

create policy "impersonation_sessions_admin_only"
  on public.impersonation_sessions for all
  using (app.is_admin())
  with check (app.is_admin());

create policy "stripe_events_idempotency_admin_only"
  on public.stripe_events_idempotency for all
  using (app.is_admin())
  with check (app.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('brand-assets', 'brand-assets', false, 10485760, array['image/png', 'image/jpeg', 'image/webp']),
  ('generation-inputs', 'generation-inputs', false, 10485760, array['image/png', 'image/jpeg', 'image/webp']),
  ('generation-outputs', 'generation-outputs', false, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "storage_brand_assets_select"
  on storage.objects for select
  using (bucket_id = 'brand-assets' and (owner = auth.uid() or app.is_admin()));

create policy "storage_brand_assets_insert"
  on storage.objects for insert
  with check (bucket_id = 'brand-assets' and (owner = auth.uid() or app.is_admin()));

create policy "storage_brand_assets_update"
  on storage.objects for update
  using (bucket_id = 'brand-assets' and (owner = auth.uid() or app.is_admin()))
  with check (bucket_id = 'brand-assets' and (owner = auth.uid() or app.is_admin()));

create policy "storage_brand_assets_delete"
  on storage.objects for delete
  using (bucket_id = 'brand-assets' and (owner = auth.uid() or app.is_admin()));

create policy "storage_generation_inputs_select"
  on storage.objects for select
  using (bucket_id = 'generation-inputs' and (owner = auth.uid() or app.is_admin()));

create policy "storage_generation_inputs_insert"
  on storage.objects for insert
  with check (bucket_id = 'generation-inputs' and (owner = auth.uid() or app.is_admin()));

create policy "storage_generation_inputs_update"
  on storage.objects for update
  using (bucket_id = 'generation-inputs' and (owner = auth.uid() or app.is_admin()))
  with check (bucket_id = 'generation-inputs' and (owner = auth.uid() or app.is_admin()));

create policy "storage_generation_inputs_delete"
  on storage.objects for delete
  using (bucket_id = 'generation-inputs' and (owner = auth.uid() or app.is_admin()));

create policy "storage_generation_outputs_select"
  on storage.objects for select
  using (bucket_id = 'generation-outputs' and (owner = auth.uid() or app.is_admin()));

create policy "storage_generation_outputs_insert"
  on storage.objects for insert
  with check (bucket_id = 'generation-outputs' and (owner = auth.uid() or app.is_admin()));

create policy "storage_generation_outputs_update"
  on storage.objects for update
  using (bucket_id = 'generation-outputs' and (owner = auth.uid() or app.is_admin()))
  with check (bucket_id = 'generation-outputs' and (owner = auth.uid() or app.is_admin()));

create policy "storage_generation_outputs_delete"
  on storage.objects for delete
  using (bucket_id = 'generation-outputs' and (owner = auth.uid() or app.is_admin()));

grant usage on schema app to postgres, service_role, authenticated, anon;
grant execute on function app.is_admin() to authenticated, service_role;
grant execute on function app.sp_grant_tokens(uuid, bigint, text, text, uuid, text) to service_role;
grant execute on function app.sp_consume_tokens(uuid, bigint, text, text, uuid, text) to service_role;
grant execute on function app.sp_check_rate_limit(uuid, text, integer, integer) to service_role;

