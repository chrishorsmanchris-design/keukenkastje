-- Create public bucket for recipe images
insert into storage.buckets (id, name, public) values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload
create policy "auth upload recipe images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'recipe-images');

-- Allow authenticated users to update (overwrite)
create policy "auth update recipe images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'recipe-images');

-- Public read
create policy "public read recipe images"
  on storage.objects for select
  to public
  using (bucket_id = 'recipe-images');
