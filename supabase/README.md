# Supabase

This directory contains JVRecruit database migrations and backend setup notes.

## Rules

- Apply only to the dedicated JVRecruit Supabase project.
- Never run these migrations against the TTM PR database.
- All exposed tables use explicit grants plus RLS.
- Candidate PII is not anonymously readable.
- Public candidate submissions go through server-side code / Edge Functions.
- Résumés are stored in a private Storage bucket.

## Migration order

1. `0001_initial_schema.sql`
2. `0002_storage.sql`

## Initial admin

Create the admin in Supabase Auth first.

Then insert a recruiter record using the Auth UUID:

```sql
insert into public.recruiters (auth_user_id, email, name, role, active)
values (
  '<AUTH_USER_UUID>',
  '<ADMIN_EMAIL>',
  '<ADMIN_NAME>',
  'admin',
  true
);
```

Do not hardcode the UUID or email in a migration committed to GitHub.
