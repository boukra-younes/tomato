-- =========================================================================
-- migration_4.sql
-- Adds ai_foods — the self-learning cache for the Gemini-backed raw-
-- ingredient search fallback. Safe to run on an existing project.
--
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- =========================================================================

create extension if not exists "uuid-ossp";

create table if not exists ai_foods (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  canonical_name text not null,
  ingredient text,
  category text,
  preparation text,
  aliases text[] default '{}',
  calories numeric not null default 0,
  protein numeric default 0,
  fat numeric default 0,
  carbs numeric default 0,
  confidence numeric default 0,
  ai_generated boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_ai_foods_slug on ai_foods(slug);
create index if not exists idx_ai_foods_canonical_name on ai_foods using gin (to_tsvector('simple', canonical_name));
create index if not exists idx_ai_foods_ingredient on ai_foods using gin (to_tsvector('simple', coalesce(ingredient, '')));
create index if not exists idx_ai_foods_aliases on ai_foods using gin (aliases);

alter table ai_foods enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'ai_foods' and policyname = 'authenticated read ai_foods'
  ) then
    create policy "authenticated read ai_foods" on ai_foods
      for select using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'ai_foods' and policyname = 'authenticated write ai_foods'
  ) then
    create policy "authenticated write ai_foods" on ai_foods
      for insert with check (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'ai_foods' and policyname = 'authenticated update ai_foods'
  ) then
    create policy "authenticated update ai_foods" on ai_foods
      for update using (auth.role() = 'authenticated');
  end if;
end $$;

-- select table_name from information_schema.tables
-- where table_schema = 'public' and table_name = 'ai_foods';
