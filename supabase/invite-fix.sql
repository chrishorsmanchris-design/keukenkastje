-- Allow users to delete a household they own (needed when joining another household)
create policy "owner can delete household" on households for delete using (
  id in (select household_id from profiles where id = auth.uid() and is_owner = true)
);

-- Allow service role to use inviteUserByEmail (already enabled by default)
-- Make sure "Enable email confirmations" is OFF in Supabase Auth settings for magic links to work
