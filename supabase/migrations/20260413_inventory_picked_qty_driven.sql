-- Make inventory driven by picked qty, not delivery status.
-- Rules:
-- - order lines reserve qty_allocated = qty - packed_qty
-- - packed_qty reduces qty_on_hand and qty_allocated together
-- - deleting a line reverses its current effect
-- - delivery status no longer changes inventory

create or replace function public.tp_inventory_line_effect(
  p_qty integer,
  p_packed_qty integer
)
returns table (
  qty_on_hand_delta integer,
  qty_allocated_delta integer
)
language plpgsql
as $function$
declare
  v_qty integer := greatest(coalesce(p_qty, 0), 0);
  v_packed integer := greatest(coalesce(p_packed_qty, 0), 0);
begin
  if v_packed > v_qty then
    v_packed := v_qty;
  end if;

  qty_on_hand_delta := -v_packed;
  qty_allocated_delta := greatest(v_qty - v_packed, 0);
  return next;
end;
$function$;

create or replace function public.tp_inventory_line_apply(
  p_order_id uuid,
  p_product_id uuid,
  p_qty integer,
  p_packed_qty integer
)
returns void
language plpgsql
as $function$
declare
  v_qty_on_hand_delta integer := 0;
  v_qty_allocated_delta integer := 0;
begin
  if p_product_id is null then
    return;
  end if;

  select e.qty_on_hand_delta, e.qty_allocated_delta
  into v_qty_on_hand_delta, v_qty_allocated_delta
  from public.tp_inventory_line_effect(p_qty, p_packed_qty) as e;

  if coalesce(v_qty_on_hand_delta, 0) = 0 and coalesce(v_qty_allocated_delta, 0) = 0 then
    return;
  end if;

  perform public.tp_inventory_apply_delta(
    p_product_id,
    v_qty_on_hand_delta,
    v_qty_allocated_delta,
    'line_apply',
    'order_lines',
    null,
    jsonb_build_object(
      'order_id', p_order_id,
      'qty', greatest(coalesce(p_qty, 0), 0),
      'packed_qty', greatest(coalesce(p_packed_qty, 0), 0)
    )
  );
end;
$function$;

create or replace function public.tp_inventory_line_revert(
  p_order_id uuid,
  p_product_id uuid,
  p_qty integer,
  p_packed_qty integer
)
returns void
language plpgsql
as $function$
declare
  v_qty_on_hand_delta integer := 0;
  v_qty_allocated_delta integer := 0;
begin
  if p_product_id is null then
    return;
  end if;

  select -e.qty_on_hand_delta, -e.qty_allocated_delta
  into v_qty_on_hand_delta, v_qty_allocated_delta
  from public.tp_inventory_line_effect(p_qty, p_packed_qty) as e;

  if coalesce(v_qty_on_hand_delta, 0) = 0 and coalesce(v_qty_allocated_delta, 0) = 0 then
    return;
  end if;

  perform public.tp_inventory_apply_delta(
    p_product_id,
    v_qty_on_hand_delta,
    v_qty_allocated_delta,
    'line_revert',
    'order_lines',
    null,
    jsonb_build_object(
      'order_id', p_order_id,
      'qty', greatest(coalesce(p_qty, 0), 0),
      'packed_qty', greatest(coalesce(p_packed_qty, 0), 0)
    )
  );
end;
$function$;

create or replace function public.tp_inventory_from_order_lines_trg()
returns trigger
language plpgsql
as $function$
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
$function$;

drop trigger if exists trg_inventory_from_order_status on public.orders;

drop trigger if exists trg_inventory_from_order_lines on public.order_lines;
create trigger trg_inventory_from_order_lines
after insert or update of order_id, product_id, qty, packed_qty or delete
on public.order_lines
for each row execute function public.tp_inventory_from_order_lines_trg();

-- Normalize current allocations to the new rule:
-- allocated = sum(qty - packed_qty) across all order lines, independent of delivery status.
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
  where ol.product_id = i.product_id
);
