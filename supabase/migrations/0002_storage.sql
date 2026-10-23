-- JVRecruit private résumé storage.
-- Apply only to the dedicated JVRecruit Supabase project.

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do update set public = false;

-- No anonymous Storage policies are created.
-- Recruiters can read résumé objects when they are active JVRecruit recruiters.

create policy "Active recruiters can read resumes"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'resumes'
  and exists (
    select 1
    from public.recruiters r
    where r.auth_user_id = (select auth.uid())
      and r.active = true
  )
);

create policy "Active recruiters can upload resumes"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'resumes'
  and exists (
    select 1
    from public.recruiters r
    where r.auth_user_id = (select auth.uid())
      and r.active = true
  )
);

create policy "Active recruiters can update resumes"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'resumes'
  and exists (
    select 1
    from public.recruiters r
    where r.auth_user_id = (select auth.uid())
      and r.active = true
  )
)
with check (
  bucket_id = 'resumes'
  and exists (
    select 1
    from public.recruiters r
    where r.auth_user_id = (select auth.uid())
      and r.active = true
  )
);

create policy "Active recruiters can delete resumes"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'resumes'
  and exists (
    select 1
    from public.recruiters r
    where r.auth_user_id = (select auth.uid())
      and r.active = true
  )
);
