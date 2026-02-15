create extension if not exists pgcrypto;

create or replace function public.tp_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products(id) on delete cascade,
  qty_on_hand integer not null default 0 check (qty_on_hand >= 0),
  qty_allocated integer not null default 0 check (qty_allocated >= 0),
  qty_available integer generated always as (greatest(qty_on_hand - qty_allocated, 0)) stored,
  low_stock_threshold integer not null default 0 check (low_stock_threshold >= 0),
  last_counted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inventory_qty_available
  on public.inventory (qty_available);

drop trigger if exists trg_inventory_set_updated_at on public.inventory;
create trigger trg_inventory_set_updated_at
before update on public.inventory
for each row execute function public.tp_set_updated_at();
