-- =========================================================================
-- migration_7.sql
-- Server-side storage for Google Fit refresh tokens, so the connection
-- survives page reloads and follows the user across devices instead of
-- living only in one browser's memory/localStorage. Never touched
-- directly by the browser — only the google-fit-auth Edge Function
-- (via the service-role key, which bypasses RLS) reads or writes it, so
-- no policies are granted to anon/authenticated on purpose.
--
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- =========================================================================

create table if not exists google_fit_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz default now()
);

alter table google_fit_tokens enable row level security;
