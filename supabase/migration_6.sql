-- =========================================================================
-- migration_6.sql
-- Fixes step_logs: the unique constraint was on log_date alone (shared
-- across every user, so a second user logging steps on a date already
-- used by another user would collide) instead of (user_id, log_date),
-- which also silently broke the app's upsert(... onConflict:
-- 'user_id,log_date') — Postgres had no matching constraint, so every
-- sync/save upsert failed and the "last synced" step count never actually
-- persisted. Also adds a calories column to store the steps-based burn
-- estimate.
--
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- =========================================================================

alter table step_logs drop constraint if exists step_logs_log_date_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'step_logs_user_date_key'
  ) then
    alter table step_logs add constraint step_logs_user_date_key unique (user_id, log_date);
  end if;
end $$;

alter table step_logs add column if not exists calories numeric default 0;
