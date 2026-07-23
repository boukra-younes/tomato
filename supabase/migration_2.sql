-- =========================================================================
-- migration_2.sql
-- Safe to run on an existing project, even if some of this already exists.
-- Fixes: 404 on daily_logs (table was added to schema.sql after your first
-- run and never applied), and adds food_cache for the new nutritionApi.js
-- Supabase caching layer.
--
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- =========================================================================

create extension if not exists "uuid-ossp";

-- -------------------------------------------------------------------------
-- daily_logs (Track Progress tab: date / calories eaten / weight)
-- -------------------------------------------------------------------------
create table if not exists daily_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  calories_eaten numeric,
  weight_kg numeric,
  created_at timestamptz default now(),
  unique(user_id, log_date)
);

alter table daily_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'daily_logs' and policyname = 'own daily_logs'
  ) then
    create policy "own daily_logs" on daily_logs
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- -------------------------------------------------------------------------
-- food_cache (shared lookup cache used by the new nutritionApi.js)
-- -------------------------------------------------------------------------
create table if not exists food_cache (
  id text primary key,
  source text,
  ref text,
  barcode text,
  name text,
  brand text,
  category text,
  image text,
  ingredients text,
  serving_size numeric default 100,
  serving_unit text default 'g',
  calories numeric default 0,
  protein numeric default 0,
  carbs numeric default 0,
  fat numeric default 0,
  fiber numeric default 0,
  sugar numeric default 0,
  saturated_fat numeric default 0,
  trans_fat numeric default 0,
  cholesterol numeric default 0,
  sodium numeric default 0,
  potassium numeric default 0,
  calcium numeric default 0,
  iron numeric default 0,
  magnesium numeric default 0,
  phosphorus numeric default 0,
  zinc numeric default 0,
  copper numeric default 0,
  selenium numeric default 0,
  vitamin_a numeric default 0,
  vitamin_b1 numeric default 0,
  vitamin_b2 numeric default 0,
  vitamin_b3 numeric default 0,
  vitamin_b5 numeric default 0,
  vitamin_b6 numeric default 0,
  vitamin_b12 numeric default 0,
  vitamin_c numeric default 0,
  vitamin_d numeric default 0,
  vitamin_e numeric default 0,
  vitamin_k numeric default 0,
  folate numeric default 0,
  created_at timestamptz default now()
);

create index if not exists idx_food_cache_name on food_cache using gin (to_tsvector('simple', name));

alter table food_cache enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'food_cache' and policyname = 'authenticated read food_cache'
  ) then
    create policy "authenticated read food_cache" on food_cache
      for select using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'food_cache' and policyname = 'authenticated write food_cache'
  ) then
    create policy "authenticated write food_cache" on food_cache
      for insert with check (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'food_cache' and policyname = 'authenticated update food_cache'
  ) then
    create policy "authenticated update food_cache" on food_cache
      for update using (auth.role() = 'authenticated');
  end if;
end $$;

-- -------------------------------------------------------------------------
-- Sanity check — run after the above to confirm both tables now exist
-- -------------------------------------------------------------------------
-- select table_name from information_schema.tables
-- where table_schema = 'public' and table_name in ('daily_logs', 'food_cache');
