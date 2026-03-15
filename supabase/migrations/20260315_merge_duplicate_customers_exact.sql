-- One-time exact customer merge cleanup.
-- Because public.customers stores full_name (not separate first/last columns),
-- this merges only when customers match on:
--   1. exact normalized full_name
--   2. exact normalized phone
--   3. exactly one normalized non-empty email across linked orders
-- If any of those are missing or ambiguous, the customer is left untouched.

begin;

create temporary table tp_customer_email_rollup_onetime on commit drop as
select
  c.id as customer_id,
  lower(trim(coalesce(c.full_name, ''))) as full_name_key,
  regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') as phone_key,
  count(distinct lower(trim(o.email))) filter (
    where nullif(trim(coalesce(o.email, '')), '') is not null
  ) as email_count,
  min(lower(trim(o.email))) filter (
    where nullif(trim(coalesce(o.email, '')), '') is not null
  ) as email_key,
  c.created_at
from public.customers c
left join public.orders o
  on o.customer_id = c.id
group by c.id, c.full_name, c.phone, c.created_at;

create temporary table tp_customer_merge_map_onetime on commit drop as
with eligible as (
  select
    r.customer_id,
    r.full_name_key,
    r.phone_key,
    r.email_key,
    r.created_at
  from tp_customer_email_rollup_onetime r
  where r.full_name_key <> ''
    and r.phone_key <> ''
    and r.email_count = 1
    and r.email_key is not null
),
ranked as (
  select
    e.*,
    first_value(e.customer_id) over (
      partition by e.full_name_key, e.phone_key, e.email_key
      order by e.created_at asc, e.customer_id asc
    ) as canonical_customer_id,
    count(*) over (
      partition by e.full_name_key, e.phone_key, e.email_key
    ) as duplicate_count
  from eligible e
)
select
  customer_id as duplicate_customer_id,
  canonical_customer_id
from ranked
where duplicate_count > 1
  and customer_id <> canonical_customer_id;

update public.customers canonical
set available_steak_credits =
  coalesce(canonical.available_steak_credits, 0) + coalesce(rollup.extra_credits, 0)
from (
  select
    m.canonical_customer_id,
    sum(coalesce(dup.available_steak_credits, 0)) as extra_credits
  from tp_customer_merge_map_onetime m
  join public.customers dup
    on dup.id = m.duplicate_customer_id
  group by m.canonical_customer_id
) rollup
where canonical.id = rollup.canonical_customer_id;

update public.orders o
set customer_id = m.canonical_customer_id
from tp_customer_merge_map_onetime m
where o.customer_id = m.duplicate_customer_id;

delete from public.customers c
using tp_customer_merge_map_onetime m
where c.id = m.duplicate_customer_id;

commit;
