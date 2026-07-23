-- =========================================================================
-- migration_3.sql
-- Adds full set-by-set workout tracking (workout_sessions, workout_sets).
-- Safe to run on an existing project — create table if not exists +
-- guarded policy creation, so re-running does nothing destructive.
--
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- =========================================================================

create extension if not exists "uuid-ossp";

create table if not exists workout_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  name text default 'Workout',
  started_at timestamptz default now(),
  ended_at timestamptz,
  total_calories numeric default 0,
  notes text,
  created_at timestamptz default now()
);

create table if not exists workout_sets (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references workout_sessions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  exercise_id text not null,
  exercise_name text not null,
  exercise_category text,
  primary_muscles text[],
  equipment text,
  set_number int not null default 1,
  reps numeric,
  weight_kg numeric,
  duration_seconds numeric,
  distance_km numeric,
  intensity text default 'moderate',
  rest_seconds numeric,
  rpe numeric,
  calories numeric default 0,
  created_at timestamptz default now()
);

create index if not exists idx_workout_sets_session on workout_sets(session_id);
create index if not exists idx_workout_sessions_user_date on workout_sessions(user_id, log_date);

alter table workout_sessions enable row level security;
alter table workout_sets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'workout_sessions' and policyname = 'own workout_sessions'
  ) then
    create policy "own workout_sessions" on workout_sessions
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'workout_sets' and policyname = 'own workout_sets'
  ) then
    create policy "own workout_sets" on workout_sets
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- select table_name from information_schema.tables
-- where table_schema = 'public' and table_name in ('workout_sessions', 'workout_sets');
