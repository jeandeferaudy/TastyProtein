alter table if exists public.order_lines
add column if not exists unit_price numeric(12,2);

alter table if exists public.order_lines
add column if not exists cost_snapshot numeric(12,2);

alter table if exists public.order_lines
add column if not exists line_profit numeric(12,2);

-- Backfill unit selling price snapshot if missing.
update public.order_lines
set unit_price = coalesce(unit_price, price_snapshot, case when coalesce(qty, 0) > 0 then line_total / qty else 0 end)
where unit_price is null;

-- Backfill cost snapshot from products.product_cost when available.
do $$
declare
  v_has_products boolean := false;
  v_has_product_cost boolean := false;
begin
  select to_regclass('public.products') is not null into v_has_products;

  if v_has_products then
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'products'
        and column_name = 'product_cost'
    ) into v_has_product_cost;
  end if;

  if v_has_products and v_has_product_cost then
    execute $q$
      update public.order_lines ol
      set cost_snapshot = coalesce(ol.cost_snapshot, greatest(0, p.product_cost))
      from public.products p
      where p.id = ol.product_id
        and ol.cost_snapshot is null
    $q$;
  end if;
end;
$$;

-- Default missing cost snapshots to 0 so profit math is deterministic.
update public.order_lines
set cost_snapshot = 0
where cost_snapshot is null;

-- Backfill line-level profit using current snapshots.
update public.order_lines
set line_profit = coalesce(line_total, 0) - (coalesce(cost_snapshot, 0) * greatest(coalesce(qty, 0), 0))
where line_profit is null;

create or replace function public.tp_order_lines_set_line_profit_trg()
returns trigger
language plpgsql
as $$
begin
  new.line_profit := coalesce(new.line_total, 0) - (coalesce(new.cost_snapshot, 0) * greatest(coalesce(new.qty, 0), 0));
  return new;
end;
$$;

drop trigger if exists trg_order_lines_set_line_profit on public.order_lines;
create trigger trg_order_lines_set_line_profit
before insert or update of qty, line_total, cost_snapshot
on public.order_lines
for each row execute function public.tp_order_lines_set_line_profit_trg();
