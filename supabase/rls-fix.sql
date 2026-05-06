-- Allow trigger to insert new households and profiles on signup
create policy "allow insert households" on households for insert with check (true);
create policy "allow insert profiles" on profiles for insert with check (true);
