alter table if exists public.profiles
add column if not exists available_steak_credits numeric(12,0) not null default 0;

alter table if exists public.orders
add column if not exists steak_credits_earned numeric(12,0) not null default 0;

alter table if exists public.orders
add column if not exists steak_credits_granted boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_available_steak_credits_nonnegative'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
    add constraint profiles_available_steak_credits_nonnegative
    check (available_steak_credits >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_steak_credits_earned_nonnegative'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
    add constraint orders_steak_credits_earned_nonnegative
    check (steak_credits_earned >= 0);
  end if;
end
$$;

create or replace function public.tp_orders_set_steak_credits_earned_trg()
returns trigger
language plpgsql
as $$
declare
  v_user_id text;
begin
  v_user_id := nullif(coalesce(to_jsonb(new) ->> 'user_id', ''), '');

  if coalesce(new.steak_credits_granted, false) then
    return new;
  end if;

  if v_user_id is null then
    new.steak_credits_earned := 0;
    return new;
  end if;

  new.steak_credits_earned := greatest(round(coalesce(new.subtotal, 0) * 0.05), 0);
  return new;
end;
$$;

drop trigger if exists trg_orders_set_steak_credits_earned on public.orders;
create trigger trg_orders_set_steak_credits_earned
before insert or update of subtotal, steak_credits_granted, user_id
on public.orders
for each row execute function public.tp_orders_set_steak_credits_earned_trg();

create or replace function public.tp_orders_grant_steak_credits_trg()
returns trigger
language plpgsql
as $$
declare
  v_user_id uuid;
  v_earned numeric(12,0);
  v_rows integer := 0;
  has_profile_user_id boolean := false;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if lower(coalesce(new.status, '')) <> 'completed' then
    return new;
  end if;

  if coalesce(new.steak_credits_granted, false) then
    return new;
  end if;

  if nullif(coalesce(to_jsonb(new) ->> 'user_id', ''), '') is null then
    return new;
  end if;

  v_user_id := (to_jsonb(new) ->> 'user_id')::uuid;
  v_earned := greatest(coalesce(new.steak_credits_earned, 0), greatest(round(coalesce(new.subtotal, 0) * 0.05), 0));

  if v_earned <= 0 then
    update public.orders
    set steak_credits_earned = 0,
        steak_credits_granted = true
    where id = new.id
      and coalesce(steak_credits_granted, false) = false;
    return new;
  end if;

  update public.profiles
  set available_steak_credits = coalesce(available_steak_credits, 0) + v_earned
  where id = v_user_id;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'user_id'
    )
    into has_profile_user_id;

    if has_profile_user_id then
      execute
        'update public.profiles
         set available_steak_credits = coalesce(available_steak_credits, 0) + $1
         where user_id = $2'
      using v_earned, v_user_id;
      get diagnostics v_rows = row_count;
    end if;
  end if;

  if v_rows = 0 then
    begin
      insert into public.profiles (id, available_steak_credits)
      values (v_user_id, v_earned);
    exception
      when unique_violation then
        update public.profiles
        set available_steak_credits = coalesce(available_steak_credits, 0) + v_earned
        where id = v_user_id;
    end;
  end if;

  update public.orders
  set steak_credits_earned = v_earned,
      steak_credits_granted = true
  where id = new.id
    and coalesce(steak_credits_granted, false) = false;

  return new;
end;
$$;

drop trigger if exists trg_orders_grant_steak_credits on public.orders;
create trigger trg_orders_grant_steak_credits
after insert or update of status, subtotal, steak_credits_granted, user_id
on public.orders
for each row execute function public.tp_orders_grant_steak_credits_trg();
