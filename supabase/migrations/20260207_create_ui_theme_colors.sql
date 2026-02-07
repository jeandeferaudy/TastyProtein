create table if not exists public.ui_theme_colors (
  mode text primary key,
  accent_color text,
  text_color text,
  line_color text,
  button_border_color text,
  button_bg_color text,
  checkbox_color text,
  background_color text,
  updated_at timestamptz default now()
);
