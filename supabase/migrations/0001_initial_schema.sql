-- JVRecruit initial schema
-- Production intent: candidate master records + role-specific applications.
-- Apply only to the dedicated JVRecruit Supabase project.

create extension if not exists pgcrypto;

create table if not exists public.recruiters (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email text not null unique,
  name text not null,
  role text not null default 'recruiter' check (role in ('admin','recruiter','viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.recruiters(id) on delete set null,
  client_name text,
  client_contact text,
  title text not null,
  department text,
  status text not null default 'draft' check (status in ('draft','published','paused','closed')),
  internal_notes text,
  interview_stages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Public-safe representation. No client identity or internal notes belong here.
create table if not exists public.job_posts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  slug text not null unique,
  title text not null,
  department text,
  location text,
  workplace text,
  employment_type text,
  compensation text,
  summary text,
  description text,
  requirements text,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  email_normalized text generated always as (nullif(lower(trim(email)), '')) stored,
  phone text,
  phone_normalized text,
  linkedin_url text,
  linkedin_normalized text,
  location text,
  current_title text,
  current_company text,
  source text not null default 'other',
  latest_resume_path text,
  latest_resume_name text,
  latest_resume_uploaded_at timestamptz,
  created_by uuid references public.recruiters(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists candidates_email_unique
  on public.candidates(email_normalized)
  where email_normalized is not null;

create unique index if not exists candidates_linkedin_unique
  on public.candidates(linkedin_normalized)
  where linkedin_normalized is not null;

create index if not exists candidates_phone_idx on public.candidates(phone_normalized);
create index if not exists candidates_name_idx on public.candidates(lower(full_name));

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  stage text not null default 'Applied'
    check (stage in ('Applied','Prescreen','Submitted','Client Sub','Interviewing','Offer','Placed','Rejected','Withdrawn','Archived')),
  interview_stage text,
  source text,
  archived_reason text,
  version integer not null default 1,
  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(candidate_id, job_id)
);

create index if not exists applications_job_stage_idx
  on public.applications(job_id, stage, updated_at desc);
create index if not exists applications_candidate_idx
  on public.applications(candidate_id, updated_at desc);

create table if not exists public.candidate_notes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  author_id uuid references public.recruiters(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists candidate_notes_candidate_idx
  on public.candidate_notes(candidate_id, created_at desc);

create table if not exists public.application_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  author_id uuid references public.recruiters(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists application_notes_application_idx
  on public.application_notes(application_id, created_at desc);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.candidates(id) on delete cascade,
  application_id uuid references public.applications(id) on delete cascade,
  actor_id uuid references public.recruiters(id) on delete set null,
  activity_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activities_candidate_idx
  on public.activities(candidate_id, created_at desc);
create index if not exists activities_application_idx
  on public.activities(application_id, created_at desc);

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  stage_name text not null,
  scheduled_at timestamptz,
  status text not null default 'scheduled'
    check (status in ('scheduled','completed','cancelled')),
  notes text,
  created_by uuid references public.recruiters(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Row Level Security
alter table public.recruiters enable row level security;
alter table public.jobs enable row level security;
alter table public.job_posts enable row level security;
alter table public.candidates enable row level security;
alter table public.applications enable row level security;
alter table public.candidate_notes enable row level security;
alter table public.application_notes enable row level security;
alter table public.activities enable row level security;
alter table public.interviews enable row level security;

-- Default-deny direct Data API access, then explicitly grant only what is needed.
revoke all on table public.recruiters from anon, authenticated;
revoke all on table public.jobs from anon, authenticated;
revoke all on table public.job_posts from anon, authenticated;
revoke all on table public.candidates from anon, authenticated;
revoke all on table public.applications from anon, authenticated;
revoke all on table public.candidate_notes from anon, authenticated;
revoke all on table public.application_notes from anon, authenticated;
revoke all on table public.activities from anon, authenticated;
revoke all on table public.interviews from anon, authenticated;

grant select on table public.job_posts to anon;
grant select on table public.job_posts to authenticated;
grant select, insert, update, delete on table public.recruiters to authenticated;
grant select, insert, update, delete on table public.jobs to authenticated;
grant select, insert, update, delete on table public.candidates to authenticated;
grant select, insert, update, delete on table public.applications to authenticated;
grant select, insert, update, delete on table public.candidate_notes to authenticated;
grant select, insert, update, delete on table public.application_notes to authenticated;
grant select, insert, update, delete on table public.activities to authenticated;
grant select, insert, update, delete on table public.interviews to authenticated;
grant select, insert, update, delete on table public.job_posts to authenticated;

create policy "Public can read published job posts"
on public.job_posts
for select
to anon
using (published = true);

create policy "Active recruiters can read job posts"
on public.job_posts
for select
to authenticated
using (exists (
  select 1 from public.recruiters r
  where r.auth_user_id = (select auth.uid()) and r.active = true
));

create policy "Active recruiters can manage job posts"
on public.job_posts
for all
to authenticated
using (exists (
  select 1 from public.recruiters r
  where r.auth_user_id = (select auth.uid()) and r.active = true
))
with check (exists (
  select 1 from public.recruiters r
  where r.auth_user_id = (select auth.uid()) and r.active = true
));

-- MVP internal ATS policies. Fine-grained owner/collaborator permissions can replace these later.
create policy "Active recruiters can read recruiter directory"
on public.recruiters
for select
to authenticated
using (exists (
  select 1 from public.recruiters me
  where me.auth_user_id = (select auth.uid()) and me.active = true
));

create policy "Admins can manage recruiters"
on public.recruiters
for all
to authenticated
using (exists (
  select 1 from public.recruiters me
  where me.auth_user_id = (select auth.uid()) and me.active = true and me.role = 'admin'
))
with check (exists (
  select 1 from public.recruiters me
  where me.auth_user_id = (select auth.uid()) and me.active = true and me.role = 'admin'
));

create policy "Active recruiters can manage jobs"
on public.jobs for all to authenticated
using (exists (select 1 from public.recruiters r where r.auth_user_id=(select auth.uid()) and r.active=true))
with check (exists (select 1 from public.recruiters r where r.auth_user_id=(select auth.uid()) and r.active=true));

create policy "Active recruiters can manage candidates"
on public.candidates for all to authenticated
using (exists (select 1 from public.recruiters r where r.auth_user_id=(select auth.uid()) and r.active=true))
with check (exists (select 1 from public.recruiters r where r.auth_user_id=(select auth.uid()) and r.active=true));

create policy "Active recruiters can manage applications"
on public.applications for all to authenticated
using (exists (select 1 from public.recruiters r where r.auth_user_id=(select auth.uid()) and r.active=true))
with check (exists (select 1 from public.recruiters r where r.auth_user_id=(select auth.uid()) and r.active=true));

create policy "Active recruiters can manage candidate notes"
on public.candidate_notes for all to authenticated
using (exists (select 1 from public.recruiters r where r.auth_user_id=(select auth.uid()) and r.active=true))
with check (exists (select 1 from public.recruiters r where r.auth_user_id=(select auth.uid()) and r.active=true));

create policy "Active recruiters can manage application notes"
on public.application_notes for all to authenticated
using (exists (select 1 from public.recruiters r where r.auth_user_id=(select auth.uid()) and r.active=true))
with check (exists (select 1 from public.recruiters r where r.auth_user_id=(select auth.uid()) and r.active=true));

create policy "Active recruiters can manage activities"
on public.activities for all to authenticated
using (exists (select 1 from public.recruiters r where r.auth_user_id=(select auth.uid()) and r.active=true))
with check (exists (select 1 from public.recruiters r where r.auth_user_id=(select auth.uid()) and r.active=true));

create policy "Active recruiters can manage interviews"
on public.interviews for all to authenticated
using (exists (select 1 from public.recruiters r where r.auth_user_id=(select auth.uid()) and r.active=true))
with check (exists (select 1 from public.recruiters r where r.auth_user_id=(select auth.uid()) and r.active=true));
