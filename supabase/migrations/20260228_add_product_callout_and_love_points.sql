alter table public.products
add column if not exists callout_text text,
add column if not exists love_points text;
