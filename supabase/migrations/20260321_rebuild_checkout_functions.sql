create or replace function public.checkout_cart_v2(
  p_session_id text,
  p_full_name text,
  p_email text,
  p_phone text,
  p_address text,
  p_postal_code text,
  p_notes text,
  p_delivery_date date,
  p_delivery_slot text,
  p_express_delivery boolean,
  p_add_thermal_bag boolean,
  p_subtotal numeric,
  p_delivery_fee numeric,
  p_thermal_bag_fee numeric,
  p_total numeric,
  p_payment_proof_url text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_cart_id uuid;
  v_customer_id uuid;
  v_order_id uuid;
  v_full_name text := coalesce(nullif(trim(p_full_name), ''), nullif(trim(p_phone), ''), 'Guest Customer');
  v_phone text := nullif(trim(p_phone), '');
  v_address text := coalesce(nullif(trim(p_address), ''), 'Philippines');
  v_notes text := nullif(trim(p_notes), '');
  v_postal_code text := nullif(trim(p_postal_code), '');
  v_subtotal numeric(12,2) := 0;
  v_delivery_fee numeric(12,2) := 0;
  v_thermal_fee numeric(12,2) := case when coalesce(p_add_thermal_bag, false) then 200 else 0 end;
  v_total numeric(12,2) := 0;
  v_total_qty integer := 0;
  v_rule record;
begin
  select c.id
  into v_cart_id
  from public.carts c
  where c.session_id = p_session_id
    and c.status = 'open'
  order by c.created_at desc
  limit 1;

  if v_cart_id is null then
    raise exception 'No open cart for session_id=%', p_session_id;
  end if;

  insert into public.customers (full_name, phone, address, notes)
  values (v_full_name, v_phone, v_address, v_notes)
  returning id into v_customer_id;

  insert into public.orders (
    cart_id,
    customer_id,
    session_id,
    access_scope,
    full_name,
    email,
    phone,
    address,
    postal_code,
    notes,
    delivery_date,
    delivery_slot,
    express_delivery,
    add_thermal_bag,
    status,
    payment_proof_url,
    subtotal,
    delivery_fee,
    thermal_bag_fee,
    total_qty,
    total_selling_price
  )
  values (
    v_cart_id,
    v_customer_id,
    p_session_id,
    'public',
    v_full_name,
    nullif(trim(p_email), ''),
    v_phone,
    v_address,
    v_postal_code,
    v_notes,
    p_delivery_date,
    nullif(trim(p_delivery_slot), ''),
    coalesce(p_express_delivery, false),
    coalesce(p_add_thermal_bag, false),
    'pending',
    p_payment_proof_url,
    0,
    0,
    v_thermal_fee,
    0,
    v_thermal_fee
  )
  returning id into v_order_id;

  insert into public.order_lines (
    order_id,
    product_id,
    name_snapshot,
    long_name_snapshot,
    size_snapshot,
    temperature_snapshot,
    country_snapshot,
    price_snapshot,
    unit_price,
    cost_snapshot,
    qty,
    line_total,
    added_by_admin
  )
  select
    v_order_id,
    cl.product_id,
    coalesce(nullif(trim(p.name), ''), 'Unnamed product'),
    p.long_name,
    p.size,
    p.temperature,
    p.country_of_origin,
    coalesce(p.selling_price, 0)::numeric(12,2),
    coalesce(p.selling_price, 0)::numeric(12,2),
    greatest(coalesce(p.product_cost, 0), 0)::numeric(12,2),
    greatest(coalesce(cl.qty, 0), 0)::integer,
    (coalesce(p.selling_price, 0)::numeric(12,2) * greatest(coalesce(cl.qty, 0), 0))::numeric(12,2),
    false
  from public.cart_lines cl
  join public.products p
    on p.id = cl.product_id
  where cl.cart_id = v_cart_id
    and coalesce(cl.qty, 0) > 0;

  if not exists (
    select 1
    from public.order_lines ol
    where ol.order_id = v_order_id
  ) then
    raise exception 'Cart % has no shippable lines.', v_cart_id;
  end if;

  select
    coalesce(sum(ol.line_total), 0)::numeric(12,2),
    coalesce(sum(ol.qty), 0)::integer
  into v_subtotal, v_total_qty
  from public.order_lines ol
  where ol.order_id = v_order_id;

  select dp.*
  into v_rule
  from public.delivery_pricing dp
  where dp.postal_code = v_postal_code
  order by dp.min_order_free_delivery_php asc
  limit 1;

  if v_subtotal >= 4000 then
    v_delivery_fee := 0;
  elsif v_postal_code is null then
    v_delivery_fee := coalesce(p_delivery_fee, 0);
  elsif v_rule is null then
    raise exception 'Unsupported postal code: %', v_postal_code;
  elsif v_subtotal >= coalesce(v_rule.min_order_free_delivery_php, 0) then
    v_delivery_fee := 0;
  else
    v_delivery_fee := coalesce(v_rule.delivery_fee_below_min_php, 0);
  end if;

  v_total := v_subtotal + v_delivery_fee + v_thermal_fee;

  update public.orders
  set
    subtotal = v_subtotal,
    delivery_fee = v_delivery_fee,
    thermal_bag_fee = v_thermal_fee,
    total_qty = v_total_qty,
    total_selling_price = v_total
  where id = v_order_id;

  update public.carts
  set status = 'checked_out'
  where id = v_cart_id;

  return v_order_id;
end;
$function$;

create or replace function public.checkout_cart(
  p_session_id text,
  p_full_name text,
  p_phone text,
  p_address text,
  p_notes text default null::text,
  p_payment_proof_url text default null::text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
begin
  return public.checkout_cart_v2(
    p_session_id,
    p_full_name,
    null,
    p_phone,
    p_address,
    null,
    p_notes,
    null,
    null,
    false,
    false,
    null,
    null,
    null,
    null,
    p_payment_proof_url
  );
end;
$function$;

revoke all on function public.checkout_cart_v2(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  text,
  boolean,
  boolean,
  numeric,
  numeric,
  numeric,
  numeric,
  text
) from public;
grant execute on function public.checkout_cart_v2(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  text,
  boolean,
  boolean,
  numeric,
  numeric,
  numeric,
  numeric,
  text
) to public;

revoke all on function public.checkout_cart(
  text,
  text,
  text,
  text,
  text,
  text
) from public;
grant execute on function public.checkout_cart(
  text,
  text,
  text,
  text,
  text,
  text
) to public;
