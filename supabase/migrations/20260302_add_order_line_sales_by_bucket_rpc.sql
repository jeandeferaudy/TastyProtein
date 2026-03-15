create or replace function public.tp_order_line_sales_by_bucket(
  p_start_date date,
  p_end_date date,
  p_timeline text default 'day'
)
returns table (
  bucket_key text,
  bucket_start date,
  product_id uuid,
  product_name text,
  sales_total numeric
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_timeline text := lower(coalesce(p_timeline, 'day'));
begin
  if not public.tp_is_admin() then
    return;
  end if;

  if p_start_date is null or p_end_date is null or p_start_date > p_end_date then
    return;
  end if;

  if v_timeline not in ('day', 'week', 'month') then
    raise exception 'Unsupported timeline: %', v_timeline;
  end if;

  return query
  with base as (
    select
      case
        when v_timeline = 'day' then timezone('Asia/Manila', o.created_at)::date
        when v_timeline = 'week' then date_trunc('week', timezone('Asia/Manila', o.created_at))::date
        else date_trunc('month', timezone('Asia/Manila', o.created_at))::date
      end as bucket_start,
      ol.product_id,
      coalesce(
        nullif(trim(coalesce(p.long_name, p.name, ol.long_name_snapshot, ol.name_snapshot, '')), ''),
        'Item'
      ) as product_name,
      coalesce(ol.line_total, 0)::numeric as line_total
    from public.order_lines ol
    join public.orders o on o.id = ol.order_id
    left join public.products p on p.id = ol.product_id
    where timezone('Asia/Manila', o.created_at)::date between p_start_date and p_end_date
  )
  select
    case
      when v_timeline = 'month' then to_char(b.bucket_start, 'YYYY-MM')
      else to_char(b.bucket_start, 'YYYY-MM-DD')
    end as bucket_key,
    b.bucket_start,
    b.product_id,
    max(b.product_name) as product_name,
    sum(b.line_total) as sales_total
  from base b
  group by b.bucket_start, b.product_id
  order by b.bucket_start asc, sales_total desc, product_name asc;
end;
$$;

revoke all on function public.tp_order_line_sales_by_bucket(date, date, text) from public;
grant execute on function public.tp_order_line_sales_by_bucket(date, date, text) to authenticated;
