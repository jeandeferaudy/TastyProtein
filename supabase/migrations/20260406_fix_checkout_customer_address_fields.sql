drop function if exists public.checkout_cart_v2(
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
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
  numeric,
  text
);

drop function if exists public.checkout_cart_v2(
  text,
  uuid,
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
  numeric,
  text
);

create or replace function public.checkout_cart_v2(
  p_session_id text,
  p_customer_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_address text,
  p_attention_to text,
  p_address_line1 text,
  p_address_line2 text,
  p_barangay text,
  p_city text,
  p_province text,
  p_postal_code text,
  p_country text,
  p_delivery_note text,
  p_notes text,
  p_delivery_date date,
  p_delivery_slot text,
  p_express_delivery boolean,
  p_add_thermal_bag boolean,
  p_subtotal numeric,
  p_delivery_fee numeric,
  p_thermal_bag_fee numeric,
  p_steak_credits_applied numeric,
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
  v_attention_to text := nullif(trim(p_attention_to), '');
  v_address_line1 text := nullif(trim(p_address_line1), '');
  v_address_line2 text := nullif(trim(p_address_line2), '');
  v_barangay text := nullif(trim(p_barangay), '');
  v_city text := nullif(trim(p_city), '');
  v_province text := nullif(trim(p_province), '');
  v_notes text := nullif(trim(p_notes), '');
  v_postal_code text := nullif(trim(p_postal_code), '');
  v_country text := coalesce(nullif(trim(p_country), ''), 'Philippines');
  v_delivery_note text := nullif(trim(p_delivery_note), '');
  v_subtotal numeric(12,2) := 0;
  v_delivery_fee numeric(12,2) := 0;
  v_thermal_fee numeric(12,2) := case when coalesce(p_add_thermal_bag, false) then 200 else 0 end;
  v_requested_credits numeric(12,2) := greatest(coalesce(p_steak_credits_applied, 0), 0);
  v_applied_credits numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_total_qty integer := 0;
  v_available_credits numeric(12,2) := 0;
  v_credits_enabled boolean := false;
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

  if p_customer_id is not null then
    select c.id
    into v_customer_id
    from public.customers c
    where c.id = p_customer_id;
  end if;

  if v_customer_id is null then
    insert into public.customers (
      full_name,
      phone,
      email,
      address,
      attention_to,
      address_line1,
      address_line2,
      barangay,
      city,
      province,
      postal_code,
      country,
      delivery_note,
      notes
    )
    values (
      v_full_name,
      v_phone,
      nullif(trim(p_email), ''),
      v_address,
      v_attention_to,
      v_address_line1,
      v_address_line2,
      v_barangay,
      v_city,
      v_province,
      v_postal_code,
      v_country,
      v_delivery_note,
      v_notes
    )
    returning id into v_customer_id;
  else
    update public.customers
    set
      full_name = v_full_name,
      phone = coalesce(v_phone, phone),
      email = coalesce(nullif(trim(p_email), ''), email),
      address = v_address,
      attention_to = v_attention_to,
      address_line1 = v_address_line1,
      address_line2 = v_address_line2,
      barangay = v_barangay,
      city = v_city,
      province = v_province,
      postal_code = v_postal_code,
      country = v_country,
      delivery_note = v_delivery_note,
      notes = v_notes
    where id = v_customer_id;

    select
      coalesce(c.available_steak_credits, 0),
      coalesce(c.steak_credits_enabled, false)
    into
      v_available_credits,
      v_credits_enabled
    from public.customers c
    where c.id = v_customer_id;

    if v_credits_enabled then
      v_applied_credits := least(v_requested_credits, v_available_credits);
    end if;
  end if;

  insert into public.orders (
    cart_id,
    customer_id,
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
    steak_credits_applied,
    total_qty,
    total_selling_price
  )
  values (
    v_cart_id,
    v_customer_id,
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
    v_applied_credits,
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

  v_applied_credits := least(v_applied_credits, greatest(v_subtotal + v_delivery_fee + v_thermal_fee, 0));
  v_total := greatest(v_subtotal + v_delivery_fee + v_thermal_fee - v_applied_credits, 0);

  if v_applied_credits > 0 then
    update public.customers
    set available_steak_credits = greatest(0, coalesce(available_steak_credits, 0) - v_applied_credits)
    where id = v_customer_id;
  end if;

  update public.orders
  set
    subtotal = v_subtotal,
    delivery_fee = v_delivery_fee,
    thermal_bag_fee = v_thermal_fee,
    steak_credits_applied = v_applied_credits,
    total_qty = v_total_qty,
    total_selling_price = v_total
  where id = v_order_id;

  update public.carts
  set status = 'checked_out'
  where id = v_cart_id;

  return v_order_id;
end;
$function$;

drop function if exists public.checkout_cart(
  text,
  text,
  text,
  text,
  text,
  text
);

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
    null,
    p_full_name,
    null,
    p_phone,
    p_address,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
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
    null,
    p_payment_proof_url
  );
end;
$function$;

revoke all on function public.checkout_cart_v2(
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
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
  numeric,
  text
) from public;

grant execute on function public.checkout_cart_v2(
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
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
  numeric,
  text
) to anon, authenticated, service_role;

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
) to anon, authenticated, service_role;
