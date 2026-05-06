-- Households: shared environment for 2 users
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Ons huishouden',
  created_at timestamptz default now()
);

-- Users profile (extends Supabase auth.users)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  household_id uuid references households(id),
  display_name text,
  locale text default 'nl',
  is_owner boolean default false,
  created_at timestamptz default now()
);

-- Invites
create table invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  email text not null,
  token text unique not null default gen_random_uuid()::text,
  accepted boolean default false,
  created_at timestamptz default now()
);

-- Recipes
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
  cuisine text,                        -- 'italiaans', 'aziatisch', etc.
  ingredient_type text,                -- 'vis', 'vlees', 'vegetarisch', etc.
  diet_labels text[] default '{}',     -- ['vegetarisch', 'vegan', 'glutenvrij']
  ingredients jsonb default '[]',      -- [{name, amount, unit}]
  steps jsonb default '[]',            -- [{order, text, timer_minutes}]
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Favorite sources (websites + cookbooks)
create table sources (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  name text not null,
  url text,
  type text not null check (type in ('website', 'cookbook', 'instagram')),
  created_at timestamptz default now()
);

-- Pantry items
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

-- Week menu
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

-- Shopping list items
create table shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  name text not null,
  quantity numeric,
  unit text,
  category text,                       -- supermarkt afdeling
  checked boolean default false,
  checked_by uuid references auth.users,
  checked_at timestamptz,
  recipe_id uuid references recipes(id) on delete set null,
  is_manual boolean default false,
  created_at timestamptz default now()
);

-- Row Level Security
alter table households enable row level security;
alter table profiles enable row level security;
alter table invites enable row level security;
alter table recipes enable row level security;
alter table sources enable row level security;
alter table pantry_items enable row level security;
alter table week_menu enable row level security;
alter table shopping_items enable row level security;

-- Helper function: get current user's household_id
create or replace function my_household_id()
returns uuid language sql security definer stable as $$
  select household_id from profiles where id = auth.uid()
$$;

-- RLS Policies (household members see/edit their own data)
create policy "household members" on households for all using (
  id = my_household_id()
);
create policy "own profile" on profiles for all using (id = auth.uid());
create policy "household recipes" on recipes for all using (household_id = my_household_id());
create policy "household sources" on sources for all using (household_id = my_household_id());
create policy "household pantry" on pantry_items for all using (household_id = my_household_id());
create policy "household week_menu" on week_menu for all using (household_id = my_household_id());
create policy "household shopping" on shopping_items for all using (household_id = my_household_id());
create policy "household invites" on invites for all using (household_id = my_household_id());

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  new_household_id uuid;
begin
  -- Create a household for the first user
  insert into households default values returning id into new_household_id;
  insert into profiles (id, household_id, display_name, is_owner)
  values (new.id, new_household_id, new.email, true);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Realtime for shopping list
alter publication supabase_realtime add table shopping_items;
alter publication supabase_realtime add table week_menu;
