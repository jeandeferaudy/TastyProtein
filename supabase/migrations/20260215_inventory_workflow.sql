create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  movement_type text not null check (
    movement_type in (
      'allocation_increase',
      'allocation_decrease',
      'stock_in',
      'stock_out',
      'stock_adjustment'
    )
  ),
  qty integer not null check (qty > 0),
  qty_on_hand_before integer not null,
  qty_on_hand_after integer not null,
  qty_allocated_before integer not null,
  qty_allocated_after integer not null,
  reason text not null default '',
  reference_table text,
  reference_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_movements_product_created
  on public.inventory_movements (product_id, created_at desc);

create index if not exists idx_inventory_movements_reference
  on public.inventory_movements (reference_table, reference_id);

create or replace function public.tp_inventory_mode_from_status(
  p_status text,
  p_delivery_status text
)
returns text
language plpgsql
as $$
declare
  s text := lower(coalesce(p_status, ''));
  d text := lower(coalesce(p_delivery_status, ''));
begin
  if d = 'delivered' or s = 'completed' then
    return 'consume';
  end if;

  if s in ('submitted', 'confirmed') and d not in ('cancelled', 'delivered') then
    return 'allocate';
  end if;

  return 'none';
end;
$$;

create or replace function public.tp_inventory_mode_on_mult(p_mode text)
returns integer
language sql
immutable
as $$
  select case
    when p_mode = 'consume' then -1
    else 0
  end;
$$;

create or replace function public.tp_inventory_mode_alloc_mult(p_mode text)
returns integer
language sql
immutable
as $$
  select case
    when p_mode = 'allocate' then 1
    else 0
  end;
$$;

create or replace function public.tp_inventory_ensure_row(p_product_id uuid)
returns void
language plpgsql
as $$
begin
  if p_product_id is null then
    return;
  end if;

  insert into public.inventory (product_id)
  values (p_product_id)
  on conflict (product_id) do nothing;
end;
$$;

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

  if coalesce(p_qty_allocated_delta, 0) <> 0 then
    insert into public.inventory_movements (
      product_id,
      movement_type,
      qty,
      qty_on_hand_before,
      qty_on_hand_after,
      qty_allocated_before,
      qty_allocated_after,
      reason,
      reference_table,
      reference_id,
      metadata
    )
    values (
      p_product_id,
      case
        when p_qty_allocated_delta > 0 then 'allocation_increase'
        else 'allocation_decrease'
      end,
      abs(p_qty_allocated_delta),
      v_before_on,
      v_after_on,
      v_before_alloc,
      v_after_alloc,
      coalesce(p_reason, ''),
      p_reference_table,
      p_reference_id,
      coalesce(p_metadata, '{}'::jsonb)
    );
  end if;

  if coalesce(p_qty_on_hand_delta, 0) <> 0 then
    insert into public.inventory_movements (
      product_id,
      movement_type,
      qty,
      qty_on_hand_before,
      qty_on_hand_after,
      qty_allocated_before,
      qty_allocated_after,
      reason,
      reference_table,
      reference_id,
      metadata
    )
    values (
      p_product_id,
      case
        when p_qty_on_hand_delta > 0 then 'stock_in'
        else 'stock_out'
      end,
      abs(p_qty_on_hand_delta),
      v_before_on,
      v_after_on,
      v_before_alloc,
      v_after_alloc,
      coalesce(p_reason, ''),
      p_reference_table,
      p_reference_id,
      coalesce(p_metadata, '{}'::jsonb)
    );
  end if;
end;
$$;

create or replace function public.tp_inventory_apply_line_effect(
  p_order_id uuid,
  p_product_id uuid,
  p_qty integer,
  p_sign integer,
  p_reason text,
  p_reference_id uuid
)
returns void
language plpgsql
as $$
declare
  v_status text;
  v_delivery_status text;
  v_mode text;
  v_abs_qty integer := abs(coalesce(p_qty, 0));
  v_sign integer := case when coalesce(p_sign, 1) < 0 then -1 else 1 end;
  v_on_delta integer;
  v_alloc_delta integer;
begin
  if p_order_id is null or p_product_id is null or v_abs_qty = 0 then
    return;
  end if;

  select o.status, o.delivery_status
  into v_status, v_delivery_status
  from public.orders o
  where o.id = p_order_id;

  if not found then
    return;
  end if;

  v_mode := public.tp_inventory_mode_from_status(v_status, v_delivery_status);
  v_on_delta := public.tp_inventory_mode_on_mult(v_mode) * v_abs_qty * v_sign;
  v_alloc_delta := public.tp_inventory_mode_alloc_mult(v_mode) * v_abs_qty * v_sign;

  if v_on_delta = 0 and v_alloc_delta = 0 then
    return;
  end if;

  perform public.tp_inventory_apply_delta(
    p_product_id,
    v_on_delta,
    v_alloc_delta,
    p_reason,
    'order_lines',
    p_reference_id,
    jsonb_build_object('order_id', p_order_id, 'mode', v_mode)
  );
end;
$$;

create or replace function public.tp_inventory_from_order_lines_trg()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    perform public.tp_inventory_apply_line_effect(
      new.order_id,
      new.product_id,
      new.qty,
      1,
      'order_line_insert',
      new.id
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    perform public.tp_inventory_apply_line_effect(
      old.order_id,
      old.product_id,
      old.qty,
      -1,
      'order_line_update_revert',
      old.id
    );
    perform public.tp_inventory_apply_line_effect(
      new.order_id,
      new.product_id,
      new.qty,
      1,
      'order_line_update_apply',
      new.id
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.tp_inventory_apply_line_effect(
      old.order_id,
      old.product_id,
      old.qty,
      -1,
      'order_line_delete',
      old.id
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
  v_old_mode text;
  v_new_mode text;
  v_old_on_mult integer;
  v_new_on_mult integer;
  v_old_alloc_mult integer;
  v_new_alloc_mult integer;
  rec record;
  v_on_delta integer;
  v_alloc_delta integer;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  v_old_mode := public.tp_inventory_mode_from_status(old.status, old.delivery_status);
  v_new_mode := public.tp_inventory_mode_from_status(new.status, new.delivery_status);

  if v_old_mode = v_new_mode then
    return new;
  end if;

  v_old_on_mult := public.tp_inventory_mode_on_mult(v_old_mode);
  v_new_on_mult := public.tp_inventory_mode_on_mult(v_new_mode);
  v_old_alloc_mult := public.tp_inventory_mode_alloc_mult(v_old_mode);
  v_new_alloc_mult := public.tp_inventory_mode_alloc_mult(v_new_mode);

  for rec in
    select
      ol.product_id::uuid as product_id,
      sum(greatest(coalesce(ol.qty, 0), 0))::integer as qty
    from public.order_lines ol
    where ol.order_id = new.id
    group by ol.product_id
  loop
    v_on_delta := (v_new_on_mult - v_old_on_mult) * rec.qty;
    v_alloc_delta := (v_new_alloc_mult - v_old_alloc_mult) * rec.qty;

    if v_on_delta <> 0 or v_alloc_delta <> 0 then
      perform public.tp_inventory_apply_delta(
        rec.product_id,
        v_on_delta,
        v_alloc_delta,
        'order_status_transition',
        'orders',
        new.id,
        jsonb_build_object(
          'old_status', old.status,
          'new_status', new.status,
          'old_delivery_status', old.delivery_status,
          'new_delivery_status', new.delivery_status,
          'old_mode', v_old_mode,
          'new_mode', v_new_mode
        )
      );
    end if;
  end loop;

  return new;
end;
$$;

create or replace function public.tp_inventory_from_products_trg()
returns trigger
language plpgsql
as $$
begin
  perform public.tp_inventory_ensure_row(new.id);
  return new;
end;
$$;

drop trigger if exists trg_inventory_from_order_lines on public.order_lines;
create trigger trg_inventory_from_order_lines
after insert or update of order_id, product_id, qty or delete
on public.order_lines
for each row execute function public.tp_inventory_from_order_lines_trg();

drop trigger if exists trg_inventory_from_order_status on public.orders;
create trigger trg_inventory_from_order_status
after update of status, delivery_status
on public.orders
for each row execute function public.tp_inventory_from_order_status_trg();

drop trigger if exists trg_inventory_from_products on public.products;
create trigger trg_inventory_from_products
after insert on public.products
for each row execute function public.tp_inventory_from_products_trg();

insert into public.inventory (product_id)
select p.id
from public.products p
on conflict (product_id) do nothing;

with active_alloc as (
  select
    ol.product_id::uuid as product_id,
    sum(greatest(coalesce(ol.qty, 0), 0))::integer as qty
  from public.order_lines ol
  join public.orders o on o.id = ol.order_id
  where public.tp_inventory_mode_from_status(o.status, o.delivery_status) = 'allocate'
  group by ol.product_id
)
update public.inventory i
set qty_allocated = coalesce(a.qty, 0)
from active_alloc a
where i.product_id = a.product_id;

update public.inventory i
set qty_allocated = 0
where not exists (
  select 1
  from public.order_lines ol
  join public.orders o on o.id = ol.order_id
  where ol.product_id = i.product_id
    and public.tp_inventory_mode_from_status(o.status, o.delivery_status) = 'allocate'
);
