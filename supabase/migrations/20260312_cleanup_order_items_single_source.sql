-- Enforce order_lines as the single source of truth for order detail lines.
-- Safe migration steps:
-- 1) Backup legacy order_items (one-time snapshot)
-- 2) Audit parity (NOTICES)
-- 3) Backfill missing legacy rows into order_lines (idempotent)
-- 4) Recompute orders totals from order_lines
-- 5) Remove legacy order_items policies
-- 6) Optional hard drop of order_items (flag default false)

do $$
begin
  if to_regclass('public.order_items') is null then
    raise notice '[order-items-cleanup] public.order_items does not exist. Skipping backup.';
    return;
  end if;

  if to_regclass('public.order_items_archive_20260312') is null then
    execute '
      create table public.order_items_archive_20260312 as
      select oi.*, now() as archived_at
      from public.order_items oi
    ';
    raise notice '[order-items-cleanup] Backup table created: public.order_items_archive_20260312';
  else
    raise notice '[order-items-cleanup] Backup table already exists: public.order_items_archive_20260312';
  end if;
end;
$$;

do $$
declare
  v_order_items_count bigint := 0;
  v_order_lines_count bigint := 0;
  v_orders_missing_lines bigint := 0;
  v_orders_mismatch bigint := 0;
begin
  if to_regclass('public.order_lines') is null then
    raise exception '[order-items-cleanup] public.order_lines is missing. Aborting.';
  end if;

  if to_regclass('public.order_items') is not null then
    execute 'select count(*) from public.order_items' into v_order_items_count;
  end if;
  execute 'select count(*) from public.order_lines' into v_order_lines_count;

  with order_line_agg as (
    select ol.order_id, count(*) as c
    from public.order_lines ol
    group by ol.order_id
  )
  select count(*)
  into v_orders_missing_lines
  from public.orders o
  left join order_line_agg a on a.order_id = o.id
  where coalesce(a.c, 0) = 0
    and coalesce(o.total_qty, 0) > 0;

  with order_line_agg as (
    select
      ol.order_id,
      coalesce(sum(ol.qty), 0)::numeric as qty_sum,
      coalesce(sum(ol.line_total), 0)::numeric as subtotal_sum
    from public.order_lines ol
    group by ol.order_id
  )
  select count(*)
  into v_orders_mismatch
  from public.orders o
  join order_line_agg a on a.order_id = o.id
  where
    coalesce(o.total_qty, 0)::numeric <> a.qty_sum
    or abs(coalesce(o.subtotal, 0)::numeric - a.subtotal_sum) > 0.01;

  raise notice '[order-items-cleanup] row counts => order_items: %, order_lines: %', v_order_items_count, v_order_lines_count;
  raise notice '[order-items-cleanup] orders with header qty but no order_lines: %', v_orders_missing_lines;
  raise notice '[order-items-cleanup] orders with header/line mismatch before rebuild: %', v_orders_mismatch;
end;
$$;

do $$
declare
  v_has_order_items boolean;
  v_has_order_lines boolean;
  v_has_products boolean;
  v_inserted bigint := 0;

  v_has_name_snapshot boolean;
  v_has_long_name_snapshot boolean;
  v_has_size_snapshot boolean;
  v_has_temperature_snapshot boolean;
  v_has_country_snapshot boolean;
  v_has_price_snapshot boolean;
  v_has_unit_price boolean;
  v_has_packed_qty boolean;
  v_has_added_by_admin boolean;
  v_has_order_number boolean;
  v_products_join text := '';

  v_cols text[] := array['order_id', 'product_id', 'qty', 'line_total'];
  v_vals text[] := array[
    'src.order_id',
    'src.product_id',
    'greatest(0, coalesce(nullif(regexp_replace(coalesce(src.j->>''qty'', ''0''), ''[^0-9-]'', '''', ''g''), ''''), ''0'')::int)',
    'greatest(0, coalesce(nullif(regexp_replace(coalesce(src.j->>''line_total'', ''0''), ''[^0-9\.\-]'', '''', ''g''), ''''), ''0'')::numeric)'
  ];

  v_sql text;
begin
  select (to_regclass('public.order_items') is not null) into v_has_order_items;
  select (to_regclass('public.order_lines') is not null) into v_has_order_lines;
  select (to_regclass('public.products') is not null) into v_has_products;

  if not v_has_order_lines then
    raise exception '[order-items-cleanup] public.order_lines is missing. Aborting.';
  end if;

  if not v_has_order_items then
    raise notice '[order-items-cleanup] public.order_items does not exist. Backfill skipped.';
    return;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_lines' and column_name = 'name_snapshot'
  ) into v_has_name_snapshot;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_lines' and column_name = 'long_name_snapshot'
  ) into v_has_long_name_snapshot;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_lines' and column_name = 'size_snapshot'
  ) into v_has_size_snapshot;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_lines' and column_name = 'temperature_snapshot'
  ) into v_has_temperature_snapshot;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_lines' and column_name = 'country_snapshot'
  ) into v_has_country_snapshot;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_lines' and column_name = 'price_snapshot'
  ) into v_has_price_snapshot;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_lines' and column_name = 'unit_price'
  ) into v_has_unit_price;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_lines' and column_name = 'packed_qty'
  ) into v_has_packed_qty;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_lines' and column_name = 'added_by_admin'
  ) into v_has_added_by_admin;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_lines' and column_name = 'order_number'
  ) into v_has_order_number;

  if v_has_order_number then
    v_cols := array_append(v_cols, 'order_number');
    v_vals := array_append(v_vals, 'nullif(src.j->>''order_number'', '''')');
  end if;
  if v_has_name_snapshot then
    v_cols := array_append(v_cols, 'name_snapshot');
    v_vals := array_append(v_vals, 'coalesce(nullif(src.j->>''name_snapshot'', ''''), nullif(src.j->>''name'', ''''), ''Item'')');
  end if;
  if v_has_long_name_snapshot then
    v_cols := array_append(v_cols, 'long_name_snapshot');
    v_vals := array_append(v_vals, 'coalesce(nullif(src.j->>''long_name_snapshot'', ''''), nullif(src.j->>''long_name'', ''''), nullif(src.j->>''name'', ''''), ''Item'')');
  end if;
  if v_has_size_snapshot then
    v_cols := array_append(v_cols, 'size_snapshot');
    v_vals := array_append(v_vals, 'nullif(coalesce(src.j->>''size_snapshot'', src.j->>''size''), '''')');
  end if;
  if v_has_temperature_snapshot then
    v_cols := array_append(v_cols, 'temperature_snapshot');
    v_vals := array_append(v_vals, 'nullif(coalesce(src.j->>''temperature_snapshot'', src.j->>''temperature''), '''')');
  end if;
  if v_has_country_snapshot then
    v_cols := array_append(v_cols, 'country_snapshot');
    v_vals := array_append(v_vals, 'nullif(coalesce(src.j->>''country_snapshot'', src.j->>''country_of_origin''), '''')');
  end if;
  if v_has_price_snapshot then
    v_cols := array_append(v_cols, 'price_snapshot');
    if v_has_products then
      v_vals := array_append(v_vals, 'greatest(0, coalesce(nullif(regexp_replace(coalesce(src.j->>''price_snapshot'', src.j->>''unit_price'', src.j->>''price'', p.selling_price::text, ''0''), ''[^0-9\.\-]'', '''', ''g''), ''''), ''0'')::numeric)');
    else
      v_vals := array_append(v_vals, 'greatest(0, coalesce(nullif(regexp_replace(coalesce(src.j->>''price_snapshot'', src.j->>''unit_price'', src.j->>''price'', ''0''), ''[^0-9\.\-]'', '''', ''g''), ''''), ''0'')::numeric)');
    end if;
  end if;
  if v_has_unit_price then
    v_cols := array_append(v_cols, 'unit_price');
    if v_has_products then
      v_vals := array_append(v_vals, 'greatest(0, coalesce(nullif(regexp_replace(coalesce(src.j->>''unit_price'', src.j->>''price_snapshot'', src.j->>''price'', p.selling_price::text, ''0''), ''[^0-9\.\-]'', '''', ''g''), ''''), ''0'')::numeric)');
    else
      v_vals := array_append(v_vals, 'greatest(0, coalesce(nullif(regexp_replace(coalesce(src.j->>''unit_price'', src.j->>''price_snapshot'', src.j->>''price'', ''0''), ''[^0-9\.\-]'', '''', ''g''), ''''), ''0'')::numeric)');
    end if;
  end if;
  if v_has_packed_qty then
    v_cols := array_append(v_cols, 'packed_qty');
    v_vals := array_append(v_vals, 'greatest(0, coalesce(nullif(regexp_replace(coalesce(src.j->>''packed_qty'', ''0''), ''[^0-9-]'', '''', ''g''), ''''), ''0'')::int)');
  end if;
  if v_has_added_by_admin then
    v_cols := array_append(v_cols, 'added_by_admin');
    v_vals := array_append(v_vals, 'coalesce(nullif(src.j->>''added_by_admin'', '''')::boolean, false)');
  end if;

  if v_has_products then
    v_products_join := 'left join public.products p on p.id = src.product_id';
  end if;

  v_sql := format(
    $fmt$
    with parsed as (
      select
        to_jsonb(oi) as j,
        nullif(oi.order_id::text, '')::uuid as order_id,
        nullif(oi.product_id::text, '')::uuid as product_id
      from public.order_items oi
      where oi.order_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and oi.product_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ),
    inserted as (
      insert into public.order_lines (%1$s)
      select %2$s
      from parsed src
      %3$s
      where greatest(0, coalesce(nullif(regexp_replace(coalesce(src.j->>'qty', '0'), '[^0-9-]', '', 'g'), ''), '0')::int) > 0
        and not exists (
          select 1
          from public.order_lines ol
          where ol.order_id = src.order_id
            and ol.product_id = src.product_id
            and coalesce(ol.qty, 0) = greatest(0, coalesce(nullif(regexp_replace(coalesce(src.j->>'qty', '0'), '[^0-9-]', '', 'g'), ''), '0')::int)
            and abs(coalesce(ol.line_total, 0)::numeric - greatest(0, coalesce(nullif(regexp_replace(coalesce(src.j->>'line_total', '0'), '[^0-9\.\-]', '', 'g'), ''), '0')::numeric)) <= 0.01
        )
      returning 1
    )
    select count(*) from inserted
    $fmt$,
    array_to_string(v_cols, ', '),
    array_to_string(v_vals, ', '),
    v_products_join
  );

  execute v_sql into v_inserted;
  raise notice '[order-items-cleanup] backfilled rows from order_items -> order_lines: %', v_inserted;
end;
$$;

-- Recompute all order header totals from order_lines.
with line_agg as (
  select
    ol.order_id,
    coalesce(sum(ol.qty), 0)::int as total_qty,
    coalesce(sum(ol.line_total), 0)::numeric as subtotal
  from public.order_lines ol
  group by ol.order_id
)
update public.orders o
set
  total_qty = coalesce(a.total_qty, 0),
  subtotal = coalesce(a.subtotal, 0),
  total_selling_price =
    coalesce(a.subtotal, 0)
    + coalesce(o.delivery_fee, 0)
    + coalesce(o.thermal_bag_fee, 0)
from line_agg a
where a.order_id = o.id;

update public.orders o
set
  total_qty = 0,
  subtotal = 0,
  total_selling_price = coalesce(o.delivery_fee, 0) + coalesce(o.thermal_bag_fee, 0)
where not exists (
  select 1
  from public.order_lines ol
  where ol.order_id = o.id
);

do $$
declare
  v_mismatch_after bigint := 0;
begin
  with order_line_agg as (
    select
      ol.order_id,
      coalesce(sum(ol.qty), 0)::numeric as qty_sum,
      coalesce(sum(ol.line_total), 0)::numeric as subtotal_sum
    from public.order_lines ol
    group by ol.order_id
  )
  select count(*)
  into v_mismatch_after
  from public.orders o
  join order_line_agg a on a.order_id = o.id
  where
    coalesce(o.total_qty, 0)::numeric <> a.qty_sum
    or abs(coalesce(o.subtotal, 0)::numeric - a.subtotal_sum) > 0.01;

  raise notice '[order-items-cleanup] mismatches after rebuild: %', v_mismatch_after;
end;
$$;

-- Audit legacy SQL dependencies that still reference order_items.
do $$
declare
  r record;
begin
  for r in
    select n.nspname as schema_name, p.proname as function_name
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')
      and position('order_items' in pg_get_functiondef(p.oid)) > 0
  loop
    raise notice '[order-items-cleanup] function still references order_items: %.%', r.schema_name, r.function_name;
  end loop;
end;
$$;

-- Remove legacy policies on order_items (table may still exist for inspection/rollback).
do $$
declare
  p record;
begin
  if to_regclass('public.order_items') is null then
    return;
  end if;

  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'order_items'
  loop
    execute format('drop policy if exists %I on public.order_items', p.policyname);
  end loop;
end;
$$;

-- Optional final deprecation step:
-- Set v_drop_legacy := true only after parity validation in production.
do $$
declare
  v_drop_legacy boolean := false;
begin
  if not v_drop_legacy then
    raise notice '[order-items-cleanup] Legacy table retained: public.order_items (set v_drop_legacy=true to drop).';
    return;
  end if;

  if to_regclass('public.order_items') is not null then
    execute 'drop table public.order_items';
    raise notice '[order-items-cleanup] Dropped table: public.order_items';
  end if;
end;
$$;
