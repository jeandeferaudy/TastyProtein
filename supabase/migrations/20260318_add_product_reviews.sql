create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  customer_id uuid null references public.customers(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  product_name_snapshot text not null default '',
  order_number_snapshot text null,
  rating smallint not null default 5 check (rating between 1 and 5),
  tenderness_rating smallint not null default 5 check (tenderness_rating between 1 and 5),
  taste_rating smallint not null default 5 check (taste_rating between 1 and 5),
  delivery_rating smallint not null default 5 check (delivery_rating between 1 and 5),
  review_text text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text null,
  credits_reward numeric(12,0) not null default 15 check (credits_reward >= 0),
  credits_granted boolean not null default false,
  approved_at timestamptz null,
  rejected_at timestamptz null,
  published_at timestamptz null,
  approved_by uuid null references auth.users(id) on delete set null
);

create unique index if not exists idx_product_reviews_order_product_unique
  on public.product_reviews (order_id, product_id);

create index if not exists idx_product_reviews_product_status_created
  on public.product_reviews (product_id, status, created_at desc);

create index if not exists idx_product_reviews_user_created
  on public.product_reviews (user_id, created_at desc);

create index if not exists idx_product_reviews_status_created
  on public.product_reviews (status, created_at desc);

drop trigger if exists trg_product_reviews_set_updated_at on public.product_reviews;
create trigger trg_product_reviews_set_updated_at
before update on public.product_reviews
for each row execute function public.tp_set_updated_at();

create or replace function public.tp_can_manage_review_for_current_user(
  p_order_id uuid,
  p_product_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select
      auth.uid() as user_id,
      nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '') as auth_email,
      (
        select p.customer_id
        from public.profiles p
        where p.id = auth.uid()
        limit 1
      ) as customer_id,
      regexp_replace(
        coalesce(
          (
            select p.phone
            from public.profiles p
            where p.id = auth.uid()
            limit 1
          ),
          ''
        ),
        '\D',
        '',
        'g'
      ) as phone_digits
  )
  select exists (
    select 1
    from public.orders o
    join me on true
    where o.id = p_order_id
      and exists (
        select 1
        from public.order_lines ol
        where ol.order_id = o.id
          and ol.product_id = p_product_id
      )
      and (
        o.user_id = me.user_id
        or (me.customer_id is not null and o.customer_id = me.customer_id)
        or (
          me.auth_email is not null
          and nullif(lower(trim(coalesce(o.email, ''))), '') = me.auth_email
        )
        or (
          me.phone_digits <> ''
          and regexp_replace(coalesce(o.phone, ''), '\D', '', 'g') = me.phone_digits
        )
      )
  );
$$;

create or replace function public.tp_admin_set_product_review_status(
  p_review_id uuid,
  p_status text,
  p_admin_note text default null
)
returns setof public.product_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review public.product_reviews%rowtype;
  v_status text := lower(trim(coalesce(p_status, '')));
  v_note text := nullif(trim(coalesce(p_admin_note, '')), '');
  v_next_credits_granted boolean;
begin
  if not public.tp_is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_review_id is null then
    raise exception 'Review id is required';
  end if;

  if v_status not in ('pending', 'approved', 'rejected') then
    raise exception 'Invalid review status: %', p_status;
  end if;

  select *
  into v_review
  from public.product_reviews
  where id = p_review_id
  for update;

  if not found then
    raise exception 'Review not found';
  end if;

  v_next_credits_granted := coalesce(v_review.credits_granted, false);

  if v_status = 'approved'
     and not coalesce(v_review.credits_granted, false)
     and v_review.customer_id is not null
     and coalesce(v_review.credits_reward, 0) > 0 then
    update public.customers
    set available_steak_credits =
      greatest(0, coalesce(available_steak_credits, 0) + coalesce(v_review.credits_reward, 0))
    where id = v_review.customer_id;

    v_next_credits_granted := true;
  end if;

  update public.product_reviews
  set
    status = v_status,
    admin_note = case when v_status = 'approved' then null else v_note end,
    credits_granted = v_next_credits_granted,
    approved_at = case when v_status = 'approved' then now() else null end,
    rejected_at = case when v_status = 'rejected' then now() else null end,
    published_at = case when v_status = 'approved' then coalesce(published_at, now()) else null end,
    approved_by = case when v_status = 'approved' then auth.uid() else null end
  where id = p_review_id
  returning * into v_review;

  return next v_review;
end;
$$;

create or replace function public.tp_public_product_reviews(
  p_product_id uuid
)
returns table (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  order_id uuid,
  product_id uuid,
  customer_id uuid,
  display_name text,
  product_name_snapshot text,
  order_number_snapshot text,
  rating smallint,
  tenderness_rating smallint,
  taste_rating smallint,
  delivery_rating smallint,
  review_text text,
  status text,
  admin_note text,
  credits_reward numeric,
  credits_granted boolean
)
language sql
security definer
set search_path = public
as $$
  select
    r.id,
    r.created_at,
    r.updated_at,
    null::uuid as order_id,
    r.product_id,
    null::uuid as customer_id,
    r.display_name,
    r.product_name_snapshot,
    null::text as order_number_snapshot,
    r.rating,
    r.tenderness_rating,
    r.taste_rating,
    r.delivery_rating,
    r.review_text,
    r.status,
    null::text as admin_note,
    0::numeric as credits_reward,
    false as credits_granted
  from public.product_reviews r
  where r.product_id = p_product_id
    and r.status = 'approved'
  order by r.created_at desc;
$$;

revoke all on function public.tp_can_manage_review_for_current_user(uuid, uuid) from public;
grant execute on function public.tp_can_manage_review_for_current_user(uuid, uuid) to authenticated;

revoke all on function public.tp_admin_set_product_review_status(uuid, text, text) from public;
grant execute on function public.tp_admin_set_product_review_status(uuid, text, text) to authenticated;

revoke all on function public.tp_public_product_reviews(uuid) from public;
grant execute on function public.tp_public_product_reviews(uuid) to public;

alter table public.product_reviews enable row level security;

drop policy if exists "owners can read their product reviews" on public.product_reviews;
create policy "owners can read their product reviews"
on public.product_reviews
for select
to authenticated
using (
  user_id = auth.uid()
  or public.tp_can_manage_review_for_current_user(order_id, product_id)
  or public.tp_is_admin()
);

drop policy if exists "owners can insert product reviews" on public.product_reviews;
create policy "owners can insert product reviews"
on public.product_reviews
for insert
to authenticated
with check (
  user_id = auth.uid()
  and status = 'pending'
  and public.tp_can_manage_review_for_current_user(order_id, product_id)
);

drop policy if exists "owners can update pending product reviews" on public.product_reviews;
create policy "owners can update pending product reviews"
on public.product_reviews
for update
to authenticated
using (
  user_id = auth.uid()
  and status in ('pending', 'rejected')
  and public.tp_can_manage_review_for_current_user(order_id, product_id)
)
with check (
  user_id = auth.uid()
  and status = 'pending'
  and public.tp_can_manage_review_for_current_user(order_id, product_id)
);

drop policy if exists "admins can read product reviews" on public.product_reviews;
create policy "admins can read product reviews"
on public.product_reviews
for select
to authenticated
using (public.tp_is_admin());

drop policy if exists "admins can update product reviews" on public.product_reviews;
create policy "admins can update product reviews"
on public.product_reviews
for update
to authenticated
using (public.tp_is_admin())
with check (public.tp_is_admin());
