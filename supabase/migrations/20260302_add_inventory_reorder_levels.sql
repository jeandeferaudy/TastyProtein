alter table public.inventory
add column if not exists reorder_point integer not null default 0 check (reorder_point >= 0),
add column if not exists target_stock integer not null default 0 check (target_stock >= 0);

update public.inventory
set
  reorder_point = coalesce(reorder_point, 0),
  target_stock = greatest(coalesce(target_stock, 0), coalesce(reorder_point, 0));

alter table public.inventory
drop constraint if exists inventory_target_stock_gte_reorder_point_check;

alter table public.inventory
add constraint inventory_target_stock_gte_reorder_point_check
check (target_stock >= reorder_point);

create index if not exists idx_inventory_reorder_point
  on public.inventory (reorder_point);
