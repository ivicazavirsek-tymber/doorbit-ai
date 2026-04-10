-- Faza 8: admin ručna korekcija tokena (pozitivno = grant, negativno = consume) + audit zapis.

create or replace function public.admin_adjust_tokens(
  p_target_user_id uuid,
  p_delta bigint,
  p_reason text
)
returns table(new_balance bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
  v_new_balance bigint;
  v_reason text;
begin
  if not app.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  v_admin := auth.uid();
  if v_admin is null then
    raise exception 'FORBIDDEN';
  end if;

  if p_reason is null or length(trim(p_reason)) < 1 then
    raise exception 'INVALID_REASON';
  end if;

  if p_delta = 0 then
    raise exception 'INVALID_TOKEN_AMOUNT';
  end if;

  v_reason := 'admin: ' || left(trim(p_reason), 200);

  if p_delta > 0 then
    select g.new_balance into v_new_balance
    from app.sp_grant_tokens(
      p_target_user_id,
      p_delta,
      v_reason,
      'admin_adjust:' || v_admin::text || ':' || gen_random_uuid()::text,
      null,
      null
    ) g;
  else
    select c.new_balance into v_new_balance
    from app.sp_consume_tokens(
      p_target_user_id,
      abs(p_delta),
      v_reason,
      'admin_adjust:' || v_admin::text || ':' || gen_random_uuid()::text,
      null,
      null
    ) c;
  end if;

  insert into public.admin_audit_logs (admin_user_id, target_user_id, action_type, meta)
  values (
    v_admin,
    p_target_user_id,
    'token_adjust',
    jsonb_build_object(
      'delta', p_delta,
      'reason', p_reason,
      'new_balance', v_new_balance
    )
  );

  return query select v_new_balance;
end;
$$;

revoke all on function public.admin_adjust_tokens(uuid, bigint, text) from public;
grant execute on function public.admin_adjust_tokens(uuid, bigint, text) to authenticated;
