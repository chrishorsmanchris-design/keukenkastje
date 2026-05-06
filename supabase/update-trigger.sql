-- Update trigger to save display_name from signup metadata
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  new_household_id uuid;
begin
  insert into households default values returning id into new_household_id;
  insert into profiles (id, household_id, display_name, is_owner)
  values (
    new.id,
    new_household_id,
    coalesce(new.raw_user_meta_data->>'display_name', new.email),
    true
  );
  return new;
end;
$$;
