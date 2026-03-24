alter table public.customers enable row level security;

drop policy if exists "public can insert customers for checkout" on public.customers;
create policy "public can insert customers for checkout"
on public.customers
for insert
to public
with check (true);
