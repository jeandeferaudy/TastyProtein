-- Enforce non-negative line/order financial snapshots and keep order rollups in sync.

alter table if exists public.orders
add column if not exists total_cost numeric(12,2) not null default 0;

alter table if exists public.orders
add column if not exists total_profit numeric(12,2) not null default 0;

alter table if exists public.order_lines
add column if not exists cost_snapshot numeric(12,2);

alter table if exists public.order_lines
add column if not exists line_profit numeric(12,2);

alter table if exists public.order_lines
alter column cost_snapshot set default 0;

alter table if exists public.order_lines
alter column line_profit set default 0;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'order_lines'
      and column_name = 'cost_snapshot'
  ) then
    execute '
      update public.order_lines ol
      set cost_snapshot = greatest(0, coalesce(ol.cost_snapshot, p.product_cost, 0))
      from public.products p
      where p.id = ol.product_id
    ';
    execute '
      update public.order_lines
      set cost_snapshot = 0
      where cost_snapshot is null
    ';
  end if;
end;
$$;

update public.order_lines
set line_profit = greatest(0, coalesce(line_total, 0) - (coalesce(cost_snapshot, 0) * greatest(coalesce(qty, 0), 0)));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'order_lines_cost_snapshot_nonnegative'
      and conrelid = 'public.order_lines'::regclass
  ) then
    alter table public.order_lines
    add constraint order_lines_cost_snapshot_nonnegative check (cost_snapshot >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'order_lines_line_profit_nonnegative'
      and conrelid = 'public.order_lines'::regclass
  ) then
    alter table public.order_lines
    add constraint order_lines_line_profit_nonnegative check (line_profit >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_total_cost_nonnegative'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
    add constraint orders_total_cost_nonnegative check (total_cost >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_total_profit_nonnegative'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
    add constraint orders_total_profit_nonnegative check (total_profit >= 0);
  end if;
end;
$$;

create or replace function public.tp_order_lines_set_line_profit_trg()
returns trigger
language plpgsql
as $$
declare
  v_product_cost numeric(12,2);
begin
  new.qty := greatest(coalesce(new.qty, 0), 0);
  new.line_total := greatest(coalesce(new.line_total, 0), 0);

  if new.cost_snapshot is null then
    if new.product_id is not null then
      select greatest(0, coalesce(p.product_cost, 0))
      into v_product_cost
      from public.products p
      where p.id = new.product_id
      limit 1;
      new.cost_snapshot := coalesce(v_product_cost, 0);
    else
      new.cost_snapshot := 0;
    end if;
  else
    new.cost_snapshot := greatest(coalesce(new.cost_snapshot, 0), 0);
  end if;

  new.line_profit := greatest(0, coalesce(new.line_total, 0) - (coalesce(new.cost_snapshot, 0) * coalesce(new.qty, 0)));
  return new;
end;
$$;

drop trigger if exists trg_order_lines_set_line_profit on public.order_lines;
create trigger trg_order_lines_set_line_profit
before insert or update of qty, line_total, cost_snapshot, product_id
on public.order_lines
for each row execute function public.tp_order_lines_set_line_profit_trg();

create or replace function public.tp_orders_rebuild_financial_totals(p_order_id uuid)
returns void
language plpgsql
as $$
begin
  update public.orders o
  set
    total_qty = coalesce(agg.total_qty, 0),
    subtotal = coalesce(agg.subtotal, 0),
    total_cost = coalesce(agg.total_cost, 0),
    total_profit = coalesce(agg.total_profit, 0),
    total_selling_price =
      coalesce(agg.subtotal, 0)
      + coalesce(o.delivery_fee, 0)
      + coalesce(o.thermal_bag_fee, 0)
  from (
    select
      ol.order_id,
      coalesce(sum(greatest(coalesce(ol.qty, 0), 0)), 0)::int as total_qty,
      coalesce(sum(greatest(coalesce(ol.line_total, 0), 0)), 0)::numeric as subtotal,
      coalesce(sum(greatest(coalesce(ol.cost_snapshot, 0), 0) * greatest(coalesce(ol.qty, 0), 0)), 0)::numeric as total_cost,
      coalesce(sum(greatest(coalesce(ol.line_profit, 0), 0)), 0)::numeric as total_profit
    from public.order_lines ol
    where ol.order_id = p_order_id
    group by ol.order_id
  ) agg
  where o.id = p_order_id;

  update public.orders o
  set
    total_qty = 0,
    subtotal = 0,
    total_cost = 0,
    total_profit = 0,
    total_selling_price = coalesce(o.delivery_fee, 0) + coalesce(o.thermal_bag_fee, 0)
  where o.id = p_order_id
    and not exists (
      select 1
      from public.order_lines ol
      where ol.order_id = o.id
    );
end;
$$;

create or replace function public.tp_order_lines_rebuild_order_totals_trg()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.tp_orders_rebuild_financial_totals(old.order_id);
    return old;
  end if;

  perform public.tp_orders_rebuild_financial_totals(new.order_id);
  if tg_op = 'UPDATE' and old.order_id is distinct from new.order_id then
    perform public.tp_orders_rebuild_financial_totals(old.order_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_order_lines_rebuild_order_totals on public.order_lines;
create trigger trg_order_lines_rebuild_order_totals
after insert or update of order_id, qty, line_total, cost_snapshot, line_profit or delete
on public.order_lines
for each row execute function public.tp_order_lines_rebuild_order_totals_trg();

with agg as (
  select
    ol.order_id,
    coalesce(sum(greatest(coalesce(ol.qty, 0), 0)), 0)::int as total_qty,
    coalesce(sum(greatest(coalesce(ol.line_total, 0), 0)), 0)::numeric as subtotal,
    coalesce(sum(greatest(coalesce(ol.cost_snapshot, 0), 0) * greatest(coalesce(ol.qty, 0), 0)), 0)::numeric as total_cost,
    coalesce(sum(greatest(coalesce(ol.line_profit, 0), 0)), 0)::numeric as total_profit
  from public.order_lines ol
  group by ol.order_id
)
update public.orders o
set
  total_qty = coalesce(agg.total_qty, 0),
  subtotal = coalesce(agg.subtotal, 0),
  total_cost = coalesce(agg.total_cost, 0),
  total_profit = coalesce(agg.total_profit, 0),
  total_selling_price = coalesce(agg.subtotal, 0) + coalesce(o.delivery_fee, 0) + coalesce(o.thermal_bag_fee, 0)
from agg
where o.id = agg.order_id;

update public.orders o
set
  total_qty = 0,
  subtotal = 0,
  total_cost = 0,
  total_profit = 0,
  total_selling_price = coalesce(o.delivery_fee, 0) + coalesce(o.thermal_bag_fee, 0)
where not exists (
  select 1
  from public.order_lines ol
  where ol.order_id = o.id
);
