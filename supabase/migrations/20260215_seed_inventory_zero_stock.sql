insert into public.inventory (product_id, qty_on_hand, qty_allocated, low_stock_threshold)
select
  p.id,
  0,
  coalesce(i.qty_allocated, 0),
  coalesce(i.low_stock_threshold, 0)
from public.products p
left join public.inventory i on i.product_id = p.id
on conflict (product_id) do update
set
  qty_on_hand = 0,
  low_stock_threshold = coalesce(public.inventory.low_stock_threshold, 0),
  updated_at = now();
