alter table if exists public.ui_theme_colors
add column if not exists font_scale numeric(4,2);

update public.ui_theme_colors
set font_scale = greatest(1.00, least(1.30, coalesce(font_scale, 1.00)))
where true;
