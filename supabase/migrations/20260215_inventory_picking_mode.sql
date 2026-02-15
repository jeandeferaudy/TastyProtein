create or replace function public.tp_inventory_is_unpacked(p_delivery_status text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(p_delivery_status, '')) = 'unpacked';
$$;

-- Keep inventory math, but stop writing movement rows.
create or replace function public.tp_inventory_apply_delta(
  p_product_id uuid,
  p_qty_on_hand_delta integer,
  p_qty_allocated_delta integer,
  p_reason text default '',
  p_reference_table text default null,
  p_reference_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
as $$
declare
  v_before_on integer;
  v_before_alloc integer;
  v_after_on integer;
  v_after_alloc integer;
begin
  if p_product_id is null then
    return;
  end if;

  perform public.tp_inventory_ensure_row(p_product_id);

  select i.qty_on_hand, i.qty_allocated
  into v_before_on, v_before_alloc
  from public.inventory i
  where i.product_id = p_product_id
  for update;

  v_after_on := v_before_on + coalesce(p_qty_on_hand_delta, 0);
  v_after_alloc := v_before_alloc + coalesce(p_qty_allocated_delta, 0);

  if v_after_on < 0 then
    raise exception 'Inventory qty_on_hand would be negative for product % (before %, delta %).',
      p_product_id, v_before_on, p_qty_on_hand_delta;
  end if;

  if v_after_alloc < 0 then
    raise exception 'Inventory qty_allocated would be negative for product % (before %, delta %).',
      p_product_id, v_before_alloc, p_qty_allocated_delta;
  end if;

  update public.inventory
  set
    qty_on_hand = v_after_on,
    qty_allocated = v_after_alloc
  where product_id = p_product_id;
end;
$$;

create or replace function public.tp_inventory_order_is_unpacked(p_order_id uuid)
returns boolean
language plpgsql
as $$
declare
  v_delivery_status text;
begin
  if p_order_id is null then
    return false;
  end if;

  select o.delivery_status
  into v_delivery_status
  from public.orders o
  where o.id = p_order_id;

  if not found then
    return false;
  end if;

  return public.tp_inventory_is_unpacked(v_delivery_status);
end;
$$;

create or replace function public.tp_inventory_line_apply(
  p_order_id uuid,
  p_product_id uuid,
  p_qty integer,
  p_packed_qty integer
)
returns void
language plpgsql
as $$
declare
  v_qty integer := greatest(coalesce(p_qty, 0), 0);
  v_packed integer := greatest(coalesce(p_packed_qty, 0), 0);
  v_unpicked integer;
  v_alloc_delta integer := 0;
  v_on_hand_delta integer := 0;
begin
  if p_product_id is null then
    return;
  end if;

  if v_packed > v_qty then
    v_packed := v_qty;
  end if;

  v_unpicked := v_qty - v_packed;
  v_on_hand_delta := -v_packed;

  if public.tp_inventory_order_is_unpacked(p_order_id) then
    v_alloc_delta := v_unpicked;
  end if;

  if v_on_hand_delta = 0 and v_alloc_delta = 0 then
    return;
  end if;

  perform public.tp_inventory_apply_delta(
    p_product_id,
    v_on_hand_delta,
    v_alloc_delta,
    'line_apply',
    'order_lines',
    null,
    '{}'::jsonb
  );
end;
$$;

create or replace function public.tp_inventory_line_revert(
  p_order_id uuid,
  p_product_id uuid,
  p_qty integer,
  p_packed_qty integer
)
returns void
language plpgsql
as $$
declare
  v_qty integer := greatest(coalesce(p_qty, 0), 0);
  v_packed integer := greatest(coalesce(p_packed_qty, 0), 0);
  v_unpicked integer;
  v_alloc_delta integer := 0;
  v_on_hand_delta integer := 0;
begin
  if p_product_id is null then
    return;
  end if;

  if v_packed > v_qty then
    v_packed := v_qty;
  end if;

  v_unpicked := v_qty - v_packed;
  v_on_hand_delta := v_packed;

  if public.tp_inventory_order_is_unpacked(p_order_id) then
    v_alloc_delta := -v_unpicked;
  end if;

  if v_on_hand_delta = 0 and v_alloc_delta = 0 then
    return;
  end if;

  perform public.tp_inventory_apply_delta(
    p_product_id,
    v_on_hand_delta,
    v_alloc_delta,
    'line_revert',
    'order_lines',
    null,
    '{}'::jsonb
  );
end;
$$;

create or replace function public.tp_inventory_from_order_lines_trg()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    perform public.tp_inventory_line_apply(
      new.order_id,
      new.product_id,
      new.qty,
      new.packed_qty
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    perform public.tp_inventory_line_revert(
      old.order_id,
      old.product_id,
      old.qty,
      old.packed_qty
    );
    perform public.tp_inventory_line_apply(
      new.order_id,
      new.product_id,
      new.qty,
      new.packed_qty
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.tp_inventory_line_revert(
      old.order_id,
      old.product_id,
      old.qty,
      old.packed_qty
    );
    return old;
  end if;

  return null;
end;
$$;

create or replace function public.tp_inventory_from_order_status_trg()
returns trigger
language plpgsql
as $$
declare
  v_old_unpacked boolean;
  v_new_unpacked boolean;
  rec record;
  v_qty integer;
  v_packed integer;
  v_unpicked integer;
  v_alloc_delta integer;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  v_old_unpacked := public.tp_inventory_is_unpacked(old.delivery_status);
  v_new_unpacked := public.tp_inventory_is_unpacked(new.delivery_status);

  if v_old_unpacked = v_new_unpacked then
    return new;
  end if;

  -- Crossing unpacked boundary: add or release all unpicked allocation.
  for rec in
    select
      ol.product_id::uuid as product_id,
      sum(greatest(coalesce(ol.qty, 0), 0))::integer as qty,
      sum(greatest(coalesce(ol.packed_qty, 0), 0))::integer as packed_qty
    from public.order_lines ol
    where ol.order_id = new.id
    group by ol.product_id
  loop
    v_qty := greatest(coalesce(rec.qty, 0), 0);
    v_packed := greatest(coalesce(rec.packed_qty, 0), 0);
    if v_packed > v_qty then
      v_packed := v_qty;
    end if;
    v_unpicked := v_qty - v_packed;
    if v_unpicked = 0 then
      continue;
    end if;

    v_alloc_delta := case when v_new_unpacked then v_unpicked else -v_unpicked end;

    perform public.tp_inventory_apply_delta(
      rec.product_id,
      0,
      v_alloc_delta,
      'delivery_status_boundary',
      'orders',
      new.id,
      jsonb_build_object(
        'old_delivery_status', old.delivery_status,
        'new_delivery_status', new.delivery_status
      )
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_inventory_from_order_lines on public.order_lines;
create trigger trg_inventory_from_order_lines
after insert or update of order_id, product_id, qty, packed_qty or delete
on public.order_lines
for each row execute function public.tp_inventory_from_order_lines_trg();

drop trigger if exists trg_inventory_from_order_status on public.orders;
create trigger trg_inventory_from_order_status
after update of delivery_status
on public.orders
for each row execute function public.tp_inventory_from_order_status_trg();

-- Keep one inventory row per product.
insert into public.inventory (product_id)
select p.id
from public.products p
on conflict (product_id) do nothing;

-- Normalize current allocation to your new rule:
-- allocated = unpicked qty only for orders still in "unpacked" delivery_status.
with alloc as (
  select
    ol.product_id::uuid as product_id,
    sum(
      greatest(
        greatest(coalesce(ol.qty, 0), 0) - least(greatest(coalesce(ol.packed_qty, 0), 0), greatest(coalesce(ol.qty, 0), 0)),
        0
      )
    )::integer as qty_alloc
  from public.order_lines ol
  join public.orders o on o.id = ol.order_id
  where public.tp_inventory_is_unpacked(o.delivery_status)
  group by ol.product_id
)
update public.inventory i
set qty_allocated = coalesce(a.qty_alloc, 0)
from alloc a
where i.product_id = a.product_id;

update public.inventory i
set qty_allocated = 0
where not exists (
  select 1
  from public.order_lines ol
  join public.orders o on o.id = ol.order_id
  where ol.product_id = i.product_id
    and public.tp_inventory_is_unpacked(o.delivery_status)
);
