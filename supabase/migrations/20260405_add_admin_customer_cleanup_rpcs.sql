create or replace function public.tp_admin_link_customer_to_profile(
  p_profile_id uuid,
  p_customer_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.tp_is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_profile_id is null or p_customer_id is null then
    raise exception 'Profile id and customer id are required';
  end if;

  update public.profiles
  set customer_id = p_customer_id
  where id = p_profile_id;

  if not found then
    raise exception 'Profile not found';
  end if;

  update public.orders
  set user_id = p_profile_id
  where customer_id = p_customer_id
    and user_id is distinct from p_profile_id;
end;
$$;

revoke all on function public.tp_admin_link_customer_to_profile(uuid, uuid) from public;
grant execute on function public.tp_admin_link_customer_to_profile(uuid, uuid) to authenticated;

create or replace function public.tp_admin_delete_customer(
  p_customer_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.tp_is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_customer_id is null then
    raise exception 'Customer id is required';
  end if;

  update public.orders
  set customer_id = null
  where customer_id = p_customer_id;

  update public.product_reviews
  set customer_id = null
  where customer_id = p_customer_id;

  update public.profiles
  set customer_id = null
  where customer_id = p_customer_id;

  delete from public.customers
  where id = p_customer_id;

  if not found then
    raise exception 'Customer not found';
  end if;
end;
$$;

revoke all on function public.tp_admin_delete_customer(uuid) from public;
grant execute on function public.tp_admin_delete_customer(uuid) to authenticated;

create or replace function public.tp_admin_merge_customers(
  p_keep_customer_id uuid,
  p_remove_customer_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keep public.customers%rowtype;
  v_remove public.customers%rowtype;
begin
  if not public.tp_is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_keep_customer_id is null or p_remove_customer_id is null then
    raise exception 'Both customer ids are required';
  end if;

  if p_keep_customer_id = p_remove_customer_id then
    raise exception 'Cannot merge the same customer';
  end if;

  select *
  into v_keep
  from public.customers
  where id = p_keep_customer_id;

  if not found then
    raise exception 'Keep customer not found';
  end if;

  select *
  into v_remove
  from public.customers
  where id = p_remove_customer_id;

  if not found then
    raise exception 'Remove customer not found';
  end if;

  update public.orders
  set customer_id = p_keep_customer_id
  where customer_id = p_remove_customer_id;

  update public.product_reviews
  set customer_id = p_keep_customer_id
  where customer_id = p_remove_customer_id;

  update public.profiles
  set customer_id = p_keep_customer_id
  where customer_id = p_remove_customer_id;

  update public.customers
  set
    first_name = coalesce(nullif(trim(v_keep.first_name), ''), nullif(trim(v_remove.first_name), '')),
    last_name = coalesce(nullif(trim(v_keep.last_name), ''), nullif(trim(v_remove.last_name), '')),
    full_name = coalesce(
      nullif(trim(v_keep.full_name), ''),
      nullif(trim(v_remove.full_name), ''),
      'Customer'
    ),
    phone = coalesce(nullif(trim(v_keep.phone), ''), nullif(trim(v_remove.phone), ''), ''),
    email = coalesce(nullif(trim(v_keep.email), ''), nullif(trim(v_remove.email), '')),
    address = coalesce(nullif(trim(v_keep.address), ''), nullif(trim(v_remove.address), ''), ''),
    notes = coalesce(nullif(trim(v_keep.notes), ''), nullif(trim(v_remove.notes), '')),
    available_steak_credits =
      greatest(0, coalesce(v_keep.available_steak_credits, 0)) +
      greatest(0, coalesce(v_remove.available_steak_credits, 0)),
    steak_credits_enabled =
      coalesce(v_keep.steak_credits_enabled, false)
      or coalesce(v_remove.steak_credits_enabled, false)
  where id = p_keep_customer_id;

  delete from public.customers
  where id = p_remove_customer_id;

  return p_keep_customer_id;
end;
$$;

revoke all on function public.tp_admin_merge_customers(uuid, uuid) from public;
grant execute on function public.tp_admin_merge_customers(uuid, uuid) to authenticated;
