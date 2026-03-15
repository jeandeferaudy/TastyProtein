-- Drop legacy public.products.price if it is truly unused.
-- This migration is intentionally safe: it aborts when dependencies are found.

do $$
declare
  v_col_exists boolean := false;
  v_attnum int;
  v_dep_count int := 0;
  v_ref_count int := 0;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'price'
  ) into v_col_exists;

  if not v_col_exists then
    raise notice '[products.price cleanup] column does not exist; nothing to do.';
    return;
  end if;

  select a.attnum
  into v_attnum
  from pg_attribute a
  where a.attrelid = 'public.products'::regclass
    and a.attname = 'price'
    and not a.attisdropped;

  -- Hard dependency check tracked by PostgreSQL parser.
  select count(*)
  into v_dep_count
  from pg_depend d
  where d.refobjid = 'public.products'::regclass
    and d.refobjsubid = coalesce(v_attnum, 0)
    and d.classid <> 'pg_attrdef'::regclass;

  if v_dep_count > 0 then
    raise exception '[products.price cleanup] aborting: % tracked dependencies found on public.products.price', v_dep_count;
  end if;

  -- Defensive text-scan for SQL objects that may still mention products.price.
  with refs as (
    select 'view'::text as obj_type, schemaname as schema_name, viewname as obj_name
    from pg_views
    where schemaname = 'public'
      and definition ilike '%products%price%'
    union all
    select 'matview'::text as obj_type, schemaname as schema_name, matviewname as obj_name
    from pg_matviews
    where schemaname = 'public'
      and definition ilike '%products%price%'
    union all
    select 'function'::text as obj_type, n.nspname as schema_name, p.proname as obj_name
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')
      and pg_get_functiondef(p.oid) ilike '%products%price%'
  )
  select count(*) into v_ref_count from refs;

  if v_ref_count > 0 then
    raise exception '[products.price cleanup] aborting: % SQL objects still reference products.price', v_ref_count;
  end if;

  alter table public.products drop column price;
  raise notice '[products.price cleanup] dropped column public.products.price';
end;
$$;
