create or replace function public.tp_is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  has_user_id boolean;
  result boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'user_id'
  )
  into has_user_id;

  if has_user_id then
    execute $query$
      select exists (
        select 1
        from public.profiles p
        where (p.id = auth.uid() or p.user_id = auth.uid())
          and lower(coalesce(p.role, '')) = 'admin'
      )
    $query$
    into result;
  else
    select exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and lower(coalesce(p.role, '')) = 'admin'
    )
    into result;
  end if;

  return coalesce(result, false);
end;
$$;

revoke all on function public.tp_is_admin() from public;
grant execute on function public.tp_is_admin() to authenticated;

alter table public.orders enable row level security;
alter table public.order_lines enable row level security;

drop policy if exists "admins can delete orders" on public.orders;
create policy "admins can delete orders"
on public.orders
for delete
to authenticated
using (public.tp_is_admin());

drop policy if exists "admins can delete order lines" on public.order_lines;
create policy "admins can delete order lines"
on public.order_lines
for delete
to authenticated
using (public.tp_is_admin());

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'order_items'
  ) then
    execute 'alter table public.order_items enable row level security';
    execute 'drop policy if exists "admins can delete order items" on public.order_items';
    execute $policy$
      create policy "admins can delete order items"
      on public.order_items
      for delete
      to authenticated
      using (public.tp_is_admin())
    $policy$;
  end if;
end
$$;
