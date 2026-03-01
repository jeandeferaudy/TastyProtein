with base as (
  select
    p.id,
    lower(
      concat_ws(
        ' ',
        nullif(trim(p.name), ''),
        nullif(trim(p.long_name), ''),
        nullif(trim(p.type), ''),
        nullif(trim(p.cut), ''),
        nullif(trim(p.preparation), ''),
        nullif(trim(p.packaging), ''),
        nullif(trim(p.temperature), ''),
        nullif(trim(p.country_of_origin), ''),
        nullif(trim(p.size), ''),
        case
          when p.size_g is not null then nullif(trim(p.size_g::text || 'g'), '')
          else null
        end,
        nullif(trim(p.status), '')
      )
    ) as raw_text
  from public.products p
),
deduped_tokens as (
  select
    s.id,
    s.token,
    min(s.ord) as first_ord
  from (
    select
      b.id,
      regexp_replace(part.token, '[^a-z0-9]+', '', 'g') as token,
      part.ord
    from base b
    cross join lateral regexp_split_to_table(coalesce(b.raw_text, ''), '\s+') with ordinality as part(token, ord)
  ) s
  where s.token <> ''
  group by s.id, s.token
),
rebuilt_keywords as (
  select
    b.id,
    string_agg(d.token, ' ' order by d.first_ord) as keywords
  from base b
  left join deduped_tokens d on d.id = b.id
  group by b.id
)
update public.products p
set keywords = nullif(r.keywords, '')
from rebuilt_keywords r
where p.id = r.id;
