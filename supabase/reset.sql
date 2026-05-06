-- ============================================
-- COMPLETE RESET + SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop existing tables
drop table if exists shopping_items cascade;
drop table if exists week_menu cascade;
drop table if exists pantry_items cascade;
drop table if exists sources cascade;
drop table if exists recipes cascade;
drop table if exists invites cascade;
drop table if exists profiles cascade;
drop table if exists households cascade;

-- Drop existing trigger + function
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user();
drop function if exists my_household_id();

-- ============================================
-- TABLES
-- ============================================

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Ons huishouden',
  created_at timestamptz default now()
);

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  household_id uuid references households(id) on delete cascade,
  display_name text,
  locale text default 'nl',
  is_owner boolean default false,
  created_at timestamptz default now()
);

create table invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  email text not null,
  token text unique not null default gen_random_uuid()::text,
  accepted boolean default false,
  created_at timestamptz default now()
);

create table recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  source_url text,
  source_name text,
  servings integer default 2,
  prep_time_minutes integer,
  cook_time_minutes integer,
  cuisine text,
  ingredient_type text,
  diet_labels text[] default '{}',
  ingredients jsonb default '[]',
  steps jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table sources (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  name text not null,
  url text,
  type text not null check (type in ('website', 'cookbook', 'instagram')),
  created_at timestamptz default now()
);

create table pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  name text not null,
  quantity numeric default 1,
  unit text,
  expires_at date,
  added_by uuid references auth.users,
  created_at timestamptz default now()
);

create table week_menu (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  date date not null,
  meal_type text default 'dinner' check (meal_type in ('breakfast', 'lunch', 'dinner')),
  recipe_id uuid references recipes(id) on delete set null,
  servings integer default 2,
  created_at timestamptz default now(),
  unique(household_id, date, meal_type)
);

create table shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  name text not null,
  quantity numeric,
  unit text,
  category text,
  checked boolean default false,
  checked_by uuid references auth.users,
  checked_at timestamptz,
  recipe_id uuid references recipes(id) on delete set null,
  is_manual boolean default false,
  created_at timestamptz default now()
);

-- ============================================
-- RLS
-- ============================================

alter table households enable row level security;
alter table profiles enable row level security;
alter table invites enable row level security;
alter table recipes enable row level security;
alter table sources enable row level security;
alter table pantry_items enable row level security;
alter table week_menu enable row level security;
alter table shopping_items enable row level security;

create or replace function my_household_id()
returns uuid language sql security definer stable as $$
  select household_id from profiles where id = auth.uid()
$$;

create policy "household members" on households for all using (id = my_household_id());
create policy "own profile" on profiles for all using (id = auth.uid());
create policy "household recipes" on recipes for all using (household_id = my_household_id());
create policy "household sources" on sources for all using (household_id = my_household_id());
create policy "household pantry" on pantry_items for all using (household_id = my_household_id());
create policy "household week_menu" on week_menu for all using (household_id = my_household_id());
create policy "household shopping" on shopping_items for all using (household_id = my_household_id());
create policy "household invites" on invites for all using (household_id = my_household_id());
create policy "owner can delete household" on households for delete using (
  id in (select household_id from profiles where id = auth.uid() and is_owner = true)
);

-- ============================================
-- TRIGGER: auto-create household on signup
-- ============================================

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_household_id uuid;
begin
  insert into public.households (name) values ('Ons huishouden') returning id into new_household_id;
  insert into public.profiles (id, household_id, display_name, is_owner)
  values (
    new.id,
    new_household_id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    true
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================
-- REALTIME
-- ============================================

alter publication supabase_realtime add table shopping_items;
alter publication supabase_realtime add table week_menu;
