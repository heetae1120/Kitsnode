-- Run in the selected Supabase project's SQL editor. No browser role may read/write.
create table if not exists public.consultation_requests (
 id uuid primary key,
 created_at timestamptz not null default now(),
 store text not null default '',
 company text not null,
 name_role text not null,
 phone text not null,
 consented_at timestamptz not null
);
alter table public.consultation_requests enable row level security;
revoke all on public.consultation_requests from anon, authenticated;
grant select, insert on public.consultation_requests to service_role;

-- Survey answers (added for /tools/survey/). Safe to run more than once.
alter table public.consultation_requests add column if not exists answers jsonb not null default '{}'::jsonb;
