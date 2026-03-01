drop policy if exists "public can upload payment proofs" on storage.objects;
drop policy if exists "public can update payment proofs" on storage.objects;
drop policy if exists "public can read payment proofs metadata" on storage.objects;

create policy "public can upload payment proofs"
on storage.objects
for insert
to public
with check (bucket_id in ('payment-proofs', 'payment_proofs'));

create policy "public can update payment proofs"
on storage.objects
for update
to public
using (bucket_id in ('payment-proofs', 'payment_proofs'))
with check (bucket_id in ('payment-proofs', 'payment_proofs'));

create policy "public can read payment proofs metadata"
on storage.objects
for select
to public
using (bucket_id in ('payment-proofs', 'payment_proofs'));
