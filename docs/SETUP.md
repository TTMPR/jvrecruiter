# JVRecruit Setup

## 1. GitHub

Primary repository: `TTMPR/jvrecruiter`.

The existing static landing remains untouched while the production app is built. When the app is ready, the custom domain can be moved without changing the database.

Recommended environments:

- Production: `jvrecruiter.xyz`
- Preview/Staging: deployment-provider preview URL
- Local: `http://localhost:3000`

Never commit real environment values.

## 2. Supabase

Create a dedicated Supabase organization named **JVRecruit**.

Inside that organization create one project named **jvrecruit**.

Do not apply JVRecruit migrations to the existing TTM PR project.

Suggested region for Puerto Rico / US East users: `us-east-1`.

After the project is created:

1. Copy the project URL.
2. Create/use a publishable API key.
3. Keep the secret key server-side only.
4. Apply migrations in `supabase/migrations`.
5. Create the initial admin user in Supabase Auth.
6. Insert the matching recruiter row using the Auth user UUID.
7. Verify RLS before connecting the frontend.

## 3. Environment variables

Use `.env.example` as the source of truth.

Browser-safe:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`

Server-only:

- `SUPABASE_SECRET_KEY`

Never expose the secret key in browser code, GitHub, screenshots, or public logs.

## 4. Public submission flows

### Apply to a role

Public form -> server/Edge Function -> normalize identity -> find/create candidate -> create application -> upload résumé privately -> return generic success.

### Join My Network

Public form -> server/Edge Function -> normalize identity -> find/create candidate -> optional résumé upload -> no application created -> return generic success.

Anonymous users should not receive direct read access to candidate, application, note, activity, interview, recruiter or internal job tables.

## 5. Resume storage

Bucket: `resumes`

- private bucket
- no public URLs
- authorized recruiter downloads use signed URLs
- database stores object path + metadata, not file bytes

## 6. Verification checklist

Before production:

- published jobs visible anonymously
- unpublished jobs invisible anonymously
- client name never present in public job payload
- anonymous candidate table reads fail
- anonymous application table reads fail
- recruiter login works
- non-recruiter authenticated account cannot access ATS
- résumé objects are private
- duplicate candidate flow works
- same candidate can have multiple applications
- same candidate cannot have duplicate application for one job
