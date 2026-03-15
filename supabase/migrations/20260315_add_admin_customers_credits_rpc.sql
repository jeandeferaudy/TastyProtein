alter table if exists public.customers
add column if not exists available_steak_credits numeric(12,0) not null default 0;

create or replace function public.tp_admin_customer_overview()
returns table (
  id uuid,
  customer_name text,
  email text,
  has_account boolean,
  order_count bigint,
  total_ordered numeric,
  current_credits numeric
)
language sql
security definer
set search_path = public
as $$
  with latest_order as (
    select distinct on (o.customer_id)
      o.customer_id,
      nullif(trim(coalesce(o.email, '')), '') as email
    from public.orders o
    where o.customer_id is not null
    order by o.customer_id, o.created_at desc
  ),
  order_agg as (
    select
      o.customer_id,
      count(*)::bigint as order_count,
      coalesce(sum(coalesce(o.total_selling_price, 0)), 0)::numeric as total_ordered,
      bool_or(o.user_id is not null) as has_account
    from public.orders o
    where o.customer_id is not null
    group by o.customer_id
  )
  select
    c.id,
    nullif(trim(c.full_name), '') as customer_name,
    lo.email,
    coalesce(oa.has_account, false) as has_account,
    coalesce(oa.order_count, 0)::bigint as order_count,
    coalesce(oa.total_ordered, 0)::numeric as total_ordered,
    coalesce(c.available_steak_credits, 0)::numeric as current_credits
  from public.customers c
  left join latest_order lo on lo.customer_id = c.id
  left join order_agg oa on oa.customer_id = c.id
  where public.tp_is_admin()
  order by lower(coalesce(nullif(trim(c.full_name), ''), lo.email, c.id::text));
$$;

revoke all on function public.tp_admin_customer_overview() from public;
grant execute on function public.tp_admin_customer_overview() to authenticated;

create or replace function public.tp_admin_adjust_steak_credits(
  p_customer_id uuid,
  p_delta numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric;
begin
  if not public.tp_is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_customer_id is null then
    raise exception 'Customer id is required';
  end if;

  update public.customers
  set available_steak_credits = greatest(0, coalesce(available_steak_credits, 0) + coalesce(p_delta, 0))
  where id = p_customer_id
  returning available_steak_credits into v_balance;

  if v_balance is null then
    raise exception 'Customer not found';
  end if;

  return v_balance;
end;
$$;

revoke all on function public.tp_admin_adjust_steak_credits(uuid, numeric) from public;
grant execute on function public.tp_admin_adjust_steak_credits(uuid, numeric) to authenticated;
