-- Use Case Catalog — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).

create extension if not exists "pgcrypto";

create table if not exists public.use_cases (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  occurred_on     date not null default current_date,
  title           text not null,
  raw             text,
  situation       text,
  task            text,
  action          text,
  result          text,
  metric          text,
  lesson          text,
  interview_angle text,
  competencies    text[] not null default '{}',
  domains         text[] not null default '{}',
  situation_type  text
);

-- Full-text search vector (kept for when the catalog grows past client-side filtering).
alter table public.use_cases
  add column if not exists search tsvector
  generated always as (
    to_tsvector('english',
      coalesce(title,'')     || ' ' || coalesce(situation,'') || ' ' ||
      coalesce(task,'')      || ' ' || coalesce(action,'')    || ' ' ||
      coalesce(result,'')    || ' ' || coalesce(lesson,'')    || ' ' ||
      coalesce(metric,'')
    )
  ) stored;

-- Indexes
create index if not exists use_cases_user_idx   on public.use_cases (user_id, occurred_on desc);
create index if not exists use_cases_comp_idx   on public.use_cases using gin (competencies);
create index if not exists use_cases_dom_idx    on public.use_cases using gin (domains);
create index if not exists use_cases_search_idx on public.use_cases using gin (search);

-- Row Level Security: every row is private to the user who created it.
alter table public.use_cases enable row level security;

drop policy if exists "select own" on public.use_cases;
drop policy if exists "insert own" on public.use_cases;
drop policy if exists "update own" on public.use_cases;
drop policy if exists "delete own" on public.use_cases;

create policy "select own" on public.use_cases
  for select using (auth.uid() = user_id);
create policy "insert own" on public.use_cases
  for insert with check (auth.uid() = user_id);
create policy "update own" on public.use_cases
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own" on public.use_cases
  for delete using (auth.uid() = user_id);
