create extension if not exists "uuid-ossp";

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  sex text check (sex in ('male','female')),
  birth_date date,
  height_cm numeric,
  activity_level text default 'moderate',
  goal_type text default 'maintain',
  weekly_calorie_budget numeric,
  macro_preset text default 'balanced',
  macro_protein_pct numeric default 30,
  macro_carb_pct numeric default 40,
  macro_fat_pct numeric default 30,
  unit_system text default 'metric',
  theme text default 'light',
  starting_weight_kg numeric,
  goal_weight_kg numeric,
  weekly_weight_change_target_kg numeric default -0.5,
  adaptive_mode_enabled boolean default true,
  body_fat_pct numeric,
  plan_name text default 'Sustained energy deficit',
  sync_code text unique default substr(md5(random()::text), 1, 6),
  daily_deficit_kcal numeric,
  plan_started_at date default current_date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  start_weight numeric,
  target_weight numeric,
  goal_type text,
  start_date date default current_date,
  target_date date,
  sequence_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table custom_foods (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  brand text,
  barcode text,
  serving_size numeric default 100,
  serving_unit text default 'g',
  calories numeric default 0,
  protein numeric default 0,
  carbs numeric default 0,
  fiber numeric default 0,
  sugar numeric default 0,
  fat numeric default 0,
  saturated_fat numeric default 0,
  trans_fat numeric default 0,
  cholesterol numeric default 0,
  sodium numeric default 0,
  potassium numeric default 0,
  micronutrients jsonb default '{}',
  created_at timestamptz default now()
);

create table recipes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  instructions text,
  servings numeric default 1,
  is_favorite boolean default false,
  created_at timestamptz default now()
);

create table recipe_ingredients (
  id uuid primary key default uuid_generate_v4(),
  recipe_id uuid references recipes(id) on delete cascade,
  food_source text not null,
  food_ref text not null,
  food_name text not null,
  amount numeric not null,
  unit text not null
);

create table meal_templates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  meal_type text default 'custom',
  items jsonb not null default '[]',
  created_at timestamptz default now()
);

create table food_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  meal_type text not null default 'snack',
  food_source text not null,
  food_ref text,
  food_name text not null,
  brand text,
  amount numeric not null,
  unit text not null,
  calories numeric not null default 0,
  protein numeric default 0,
  carbs numeric default 0,
  fiber numeric default 0,
  sugar numeric default 0,
  fat numeric default 0,
  saturated_fat numeric default 0,
  sodium numeric default 0,
  micronutrients jsonb default '{}',
  is_favorite boolean default false,
  is_quick_add boolean default false,
  created_at timestamptz default now()
);

create index idx_food_logs_user_date on food_logs(user_id, log_date);

create table water_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  amount_ml numeric not null,
  created_at timestamptz default now()
);

create table caffeine_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  source text not null,
  amount_mg numeric not null,
  created_at timestamptz default now()
);

create table alcohol_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  standard_drinks numeric not null,
  calories numeric default 0,
  drink_type text,
  created_at timestamptz default now()
);

create table body_measurements (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  weight_kg numeric,
  body_fat_pct numeric,
  waist_cm numeric,
  hip_cm numeric,
  chest_cm numeric,
  neck_cm numeric,
  shoulders_cm numeric,
  upper_arm_cm numeric,
  forearm_cm numeric,
  thigh_cm numeric,
  calf_cm numeric,
  notes text,
  created_at timestamptz default now()
);

create unique index idx_body_meas_user_date_unique on body_measurements(user_id, log_date);

create table exercise_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  activity_name text not null,
  met_value numeric not null,
  duration_minutes numeric not null,
  distance_km numeric,
  calories_burned numeric not null,
  notes text,
  created_at timestamptz default now()
);

create table step_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  log_date date not null default current_date unique,
  steps integer not null default 0,
  source text default 'manual',
  created_at timestamptz default now()
);

create table health_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  sleep_hours numeric,
  mood integer,
  stress integer,
  energy integer,
  hunger integer,
  recovery integer,
  digestion integer,
  notes text,
  created_at timestamptz default now()
);

create table achievements (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  achievement_key text not null,
  unlocked_at timestamptz default now(),
  unique(user_id, achievement_key)
);

create table search_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  query text not null,
  created_at timestamptz default now()
);

create table calorie_target_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  bmr numeric,
  tdee numeric,
  adaptive_tdee numeric,
  is_adaptive boolean default false,
  confidence numeric default 0,
  daily_target numeric not null,
  goal_type text,
  protein_target numeric,
  carb_target numeric,
  fat_target numeric,
  clamped boolean default false,
  created_at timestamptz default now(),
  unique(user_id, log_date)
);

create table app_notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  notif_key text not null,
  priority text default 'medium',
  title text not null,
  body text,
  is_read boolean default false,
  created_at timestamptz default now()
);

create table goal_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  event_type text not null,
  event_date date not null default current_date,
  detail jsonb default '{}',
  created_at timestamptz default now()
);

create table weight_milestones (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  milestone_key text not null,
  weight_kg numeric,
  achieved_date date,
  created_at timestamptz default now(),
  unique(user_id, milestone_key)
);

alter table calorie_target_history enable row level security;
alter table app_notifications enable row level security;
alter table goal_events enable row level security;
alter table weight_milestones enable row level security;

create policy "own calorie_target_history" on calorie_target_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own app_notifications" on app_notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own goal_events" on goal_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own weight_milestones" on weight_milestones for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table daily_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  calories_eaten numeric,
  weight_kg numeric,
  created_at timestamptz default now(),
  unique(user_id, log_date)
);
alter table daily_logs enable row level security;
create policy "own daily_logs" on daily_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table profiles enable row level security;
alter table goals enable row level security;
alter table custom_foods enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table meal_templates enable row level security;
alter table food_logs enable row level security;
alter table water_logs enable row level security;
alter table caffeine_logs enable row level security;
alter table alcohol_logs enable row level security;
alter table body_measurements enable row level security;
alter table exercise_logs enable row level security;
alter table step_logs enable row level security;
alter table health_logs enable row level security;
alter table achievements enable row level security;
alter table search_history enable row level security;

create policy "own profile" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own goals" on goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own custom_foods" on custom_foods for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own recipes" on recipes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own recipe_ingredients" on recipe_ingredients for all using (
  exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid())
) with check (
  exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid())
);
create policy "own meal_templates" on meal_templates for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own food_logs" on food_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own water_logs" on water_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own caffeine_logs" on caffeine_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own alcohol_logs" on alcohol_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own body_measurements" on body_measurements for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own exercise_logs" on exercise_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own step_logs" on step_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own health_logs" on health_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own achievements" on achievements for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own search_history" on search_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
