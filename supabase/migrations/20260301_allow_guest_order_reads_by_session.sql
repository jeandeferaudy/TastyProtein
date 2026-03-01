create or replace function public.tp_request_session_id()
returns text
language sql
stable
as $$
  select nullif(current_setting('request.headers', true)::json ->> 'x-session-id', '');
$$;

grant execute on function public.tp_request_session_id() to public;

do $$
declare
  has_user_id boolean;
  has_session_id boolean;
  access_clause text := 'public.tp_is_admin()';
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'user_id'
  )
  into has_user_id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'session_id'
  )
  into has_session_id;

  if has_user_id then
    access_clause := access_clause || ' or user_id = auth.uid()';
  end if;

  if has_session_id then
    access_clause := access_clause || ' or session_id = public.tp_request_session_id()';
  end if;

  execute 'drop policy if exists "users can read visible orders" on public.orders';
  execute format(
    'create policy "users can read visible orders"
     on public.orders
     for select
     to public
     using (%s)',
    access_clause
  );

  execute 'drop policy if exists "users can read visible order lines" on public.order_lines';
  execute format(
    'create policy "users can read visible order lines"
     on public.order_lines
     for select
     to public
     using (
       exists (
         select 1
         from public.orders o
         where o.id = order_lines.order_id
           and (%s)
       )
     )',
    replace(access_clause, 'user_id', 'o.user_id')
  );

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'order_items'
  ) then
    execute 'drop policy if exists "users can read visible order items" on public.order_items';
    execute format(
      'create policy "users can read visible order items"
       on public.order_items
       for select
       to public
       using (
         exists (
           select 1
           from public.orders o
           where o.id = order_items.order_id
             and (%s)
         )
       )',
      replace(access_clause, 'user_id', 'o.user_id')
    );
  end if;
end
$$;
