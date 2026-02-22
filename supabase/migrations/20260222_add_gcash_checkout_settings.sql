alter table if exists public.ui_branding
  add column if not exists gcash_qr_url text,
  add column if not exists gcash_phone text;

insert into public.ui_branding (id)
values (1)
on conflict (id) do nothing;
