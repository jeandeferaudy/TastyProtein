alter table public.orders
add column if not exists access_scope text;

update public.orders
set access_scope = case
  when nullif(coalesce(to_jsonb(orders)->>'user_id', ''), '') is null then 'public'
  else 'private'
end
where access_scope is null
   or access_scope not in ('public', 'private');

alter table public.orders
alter column access_scope set default 'private';

alter table public.orders
drop constraint if exists orders_access_scope_check;

alter table public.orders
add constraint orders_access_scope_check
check (access_scope in ('public', 'private'));

create or replace function public.tp_orders_access_scope_trg()
returns trigger
language plpgsql
as $$
begin
  if nullif(coalesce(to_jsonb(new)->>'user_id', ''), '') is null then
    new.access_scope := 'public';
  elsif new.access_scope is null or new.access_scope not in ('public', 'private') then
    new.access_scope := 'private';
  end if;
  return new;
end
$$;

drop trigger if exists trg_orders_access_scope on public.orders;
create trigger trg_orders_access_scope
before insert or update on public.orders
for each row execute function public.tp_orders_access_scope_trg();

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
  access_clause text := 'coalesce(access_scope, ''private'') = ''public'' or public.tp_is_admin()';
  scoped_clause text := 'coalesce(o.access_scope, ''private'') = ''public'' or public.tp_is_admin()';
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
    scoped_clause := scoped_clause || ' or o.user_id = auth.uid()';
  end if;

  if has_session_id then
    access_clause := access_clause || ' or session_id = public.tp_request_session_id()';
    scoped_clause := scoped_clause || ' or o.session_id = public.tp_request_session_id()';
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
    scoped_clause
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
      scoped_clause
    );
  end if;
end
$$;
