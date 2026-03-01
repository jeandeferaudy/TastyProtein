alter table public.orders
add column if not exists placed_for_someone_else boolean not null default false;
