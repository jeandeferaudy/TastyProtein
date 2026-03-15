alter table if exists public.ui_theme_colors
add column if not exists font_family text;

update public.ui_theme_colors
set font_family = coalesce(nullif(trim(font_family), ''), 'inter')
where true;
