alter table public.orders enable row level security;
alter table public.order_lines enable row level security;

drop policy if exists "public can insert orders for checkout" on public.orders;
create policy "public can insert orders for checkout"
on public.orders
for insert
to public
with check (true);

drop policy if exists "public can insert order lines for checkout" on public.order_lines;
create policy "public can insert order lines for checkout"
on public.order_lines
for insert
to public
with check (
  exists (
    select 1
    from public.orders o
    where o.id = order_lines.order_id
  )
);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'order_items'
  ) then
    execute 'alter table public.order_items enable row level security';
    execute 'drop policy if exists "public can insert order items for checkout" on public.order_items';
    execute $policy$
      create policy "public can insert order items for checkout"
      on public.order_items
      for insert
      to public
      with check (
        exists (
          select 1
          from public.orders o
          where o.id = order_items.order_id
        )
      )
    $policy$;
  end if;
end
$$;
