create extension if not exists pgcrypto;

create sequence if not exists public.purchase_order_number_seq;

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  purchase_number text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  seller_name text,
  seller_email text,
  seller_phone text,
  seller_address text,
  notes text,
  delivery_date date,
  delivery_slot text,
  express_delivery boolean not null default false,
  add_thermal_bag boolean not null default false,
  total_qty integer not null default 0 check (total_qty >= 0),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  thermal_bag_fee numeric(12,2) not null default 0 check (thermal_bag_fee >= 0),
  total_selling_price numeric(12,2) not null default 0 check (total_selling_price >= 0),
  amount_paid numeric(12,2),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'confirmed', 'completed')),
  paid_status text not null default 'unpaid' check (paid_status in ('unpaid', 'processed', 'paid')),
  delivery_status text not null default 'unreceived' check (delivery_status in ('unreceived', 'partially received', 'received')),
  payment_proof_url text
);

create or replace function public.tp_purchase_orders_set_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.purchase_number is null or btrim(new.purchase_number) = '' then
    new.purchase_number := 'PO-' || lpad(nextval('public.purchase_order_number_seq')::text, 8, '0');
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_purchase_orders_set_defaults on public.purchase_orders;
create trigger trg_purchase_orders_set_defaults
before insert or update on public.purchase_orders
for each row execute function public.tp_purchase_orders_set_defaults();

create table if not exists public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  name_snapshot text,
  long_name_snapshot text,
  size_snapshot text,
  temperature_snapshot text,
  country_snapshot text,
  unit_price numeric(12,2) not null default 0,
  qty integer not null check (qty > 0),
  received_qty integer not null default 0 check (received_qty >= 0),
  line_total numeric(12,2) not null default 0,
  added_by_admin boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_order_lines_received_lte_qty check (received_qty <= qty)
);

create index if not exists idx_purchase_orders_created_at
  on public.purchase_orders (created_at desc);

create index if not exists idx_purchase_order_lines_purchase_order_id
  on public.purchase_order_lines (purchase_order_id);

create index if not exists idx_purchase_order_lines_product_id
  on public.purchase_order_lines (product_id);

create or replace function public.tp_purchase_order_lines_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_purchase_order_lines_set_updated_at on public.purchase_order_lines;
create trigger trg_purchase_order_lines_set_updated_at
before update on public.purchase_order_lines
for each row execute function public.tp_purchase_order_lines_set_updated_at();

create or replace function public.tp_purchase_order_lines_inventory_delta_trg()
returns trigger
language plpgsql
as $$
declare
  v_delta integer := 0;
begin
  if tg_op = 'INSERT' then
    v_delta := coalesce(new.received_qty, 0);
    if v_delta <> 0 then
      perform public.tp_inventory_apply_delta(
        new.product_id,
        v_delta,
        0,
        'purchase_received',
        'purchase_order_lines',
        new.id,
        jsonb_build_object('purchase_order_id', new.purchase_order_id)
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_delta := coalesce(new.received_qty, 0) - coalesce(old.received_qty, 0);
    if v_delta <> 0 then
      perform public.tp_inventory_apply_delta(
        new.product_id,
        v_delta,
        0,
        'purchase_received',
        'purchase_order_lines',
        new.id,
        jsonb_build_object('purchase_order_id', new.purchase_order_id)
      );
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_delta := -coalesce(old.received_qty, 0);
    if v_delta <> 0 then
      perform public.tp_inventory_apply_delta(
        old.product_id,
        v_delta,
        0,
        'purchase_received_reversal',
        'purchase_order_lines',
        old.id,
        jsonb_build_object('purchase_order_id', old.purchase_order_id)
      );
    end if;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_purchase_order_lines_inventory_delta on public.purchase_order_lines;
create trigger trg_purchase_order_lines_inventory_delta
after insert or update of received_qty or delete on public.purchase_order_lines
for each row execute function public.tp_purchase_order_lines_inventory_delta_trg();

alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;

drop policy if exists "admins can read purchase orders" on public.purchase_orders;
create policy "admins can read purchase orders"
on public.purchase_orders
for select
to authenticated
using (public.tp_is_admin());

drop policy if exists "admins can insert purchase orders" on public.purchase_orders;
create policy "admins can insert purchase orders"
on public.purchase_orders
for insert
to authenticated
with check (public.tp_is_admin());

drop policy if exists "admins can update purchase orders" on public.purchase_orders;
create policy "admins can update purchase orders"
on public.purchase_orders
for update
to authenticated
using (public.tp_is_admin())
with check (public.tp_is_admin());

drop policy if exists "admins can delete purchase orders" on public.purchase_orders;
create policy "admins can delete purchase orders"
on public.purchase_orders
for delete
to authenticated
using (public.tp_is_admin());

drop policy if exists "admins can read purchase order lines" on public.purchase_order_lines;
create policy "admins can read purchase order lines"
on public.purchase_order_lines
for select
to authenticated
using (public.tp_is_admin());

drop policy if exists "admins can insert purchase order lines" on public.purchase_order_lines;
create policy "admins can insert purchase order lines"
on public.purchase_order_lines
for insert
to authenticated
with check (public.tp_is_admin());

drop policy if exists "admins can update purchase order lines" on public.purchase_order_lines;
create policy "admins can update purchase order lines"
on public.purchase_order_lines
for update
to authenticated
using (public.tp_is_admin())
with check (public.tp_is_admin());

drop policy if exists "admins can delete purchase order lines" on public.purchase_order_lines;
create policy "admins can delete purchase order lines"
on public.purchase_order_lines
for delete
to authenticated
using (public.tp_is_admin());
