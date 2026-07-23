-- =========================================================================
-- migration_5.sql
-- Extends ai_foods with the full nutrient set (previously only calories,
-- protein, fat, carbs were stored). Safe to run on an existing project.
--
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- =========================================================================

alter table ai_foods
  add column if not exists fiber numeric default 0,
  add column if not exists sugar numeric default 0,
  add column if not exists saturated_fat numeric default 0,
  add column if not exists trans_fat numeric default 0,
  add column if not exists cholesterol numeric default 0,
  add column if not exists sodium numeric default 0,
  add column if not exists potassium numeric default 0,
  add column if not exists calcium numeric default 0,
  add column if not exists iron numeric default 0,
  add column if not exists magnesium numeric default 0,
  add column if not exists phosphorus numeric default 0,
  add column if not exists zinc numeric default 0,
  add column if not exists copper numeric default 0,
  add column if not exists selenium numeric default 0,
  add column if not exists vitamin_a numeric default 0,
  add column if not exists vitamin_b1 numeric default 0,
  add column if not exists vitamin_b2 numeric default 0,
  add column if not exists vitamin_b3 numeric default 0,
  add column if not exists vitamin_b5 numeric default 0,
  add column if not exists vitamin_b6 numeric default 0,
  add column if not exists vitamin_b12 numeric default 0,
  add column if not exists vitamin_c numeric default 0,
  add column if not exists vitamin_d numeric default 0,
  add column if not exists vitamin_e numeric default 0,
  add column if not exists vitamin_k numeric default 0,
  add column if not exists folate numeric default 0;
