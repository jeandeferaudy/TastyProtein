create or replace function public.tp_sync_order_user_id_from_customer_id(
  p_customer_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if p_customer_id is null then
    return;
  end if;

  select p.id
  into v_user_id
  from public.profiles p
  where p.customer_id = p_customer_id
  order by p.id
  limit 1;

  update public.orders o
  set user_id = v_user_id
  where o.customer_id = p_customer_id
    and o.user_id is distinct from v_user_id;
end;
$$;

create or replace function public.tp_orders_apply_user_id_from_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if new.customer_id is null then
    new.user_id := null;
    return new;
  end if;

  select p.id
  into v_user_id
  from public.profiles p
  where p.customer_id = new.customer_id
  order by p.id
  limit 1;

  new.user_id := v_user_id;
  return new;
end;
$$;

drop trigger if exists trg_orders_apply_user_id_from_customer on public.orders;
create trigger trg_orders_apply_user_id_from_customer
before insert or update of customer_id on public.orders
for each row
execute function public.tp_orders_apply_user_id_from_customer();

create or replace function public.tp_profiles_sync_orders_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.customer_id is not null then
      perform public.tp_sync_order_user_id_from_customer_id(old.customer_id);
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.customer_id is not null then
      perform public.tp_sync_order_user_id_from_customer_id(new.customer_id);
    end if;
    return new;
  end if;

  if old.customer_id is distinct from new.customer_id then
    if old.customer_id is not null then
      perform public.tp_sync_order_user_id_from_customer_id(old.customer_id);
    end if;
    if new.customer_id is not null then
      perform public.tp_sync_order_user_id_from_customer_id(new.customer_id);
    end if;
  elsif new.customer_id is not null then
    perform public.tp_sync_order_user_id_from_customer_id(new.customer_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_sync_orders_user_id on public.profiles;
create trigger trg_profiles_sync_orders_user_id
after insert or update of customer_id or delete on public.profiles
for each row
execute function public.tp_profiles_sync_orders_user_id();

update public.orders o
set user_id = p.id
from public.profiles p
where p.customer_id = o.customer_id
  and o.user_id is distinct from p.id;
