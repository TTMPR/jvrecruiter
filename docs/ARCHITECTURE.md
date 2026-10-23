# JVRecruit Architecture

## Brand and ownership

JVRecruit is the product identity. Towerhill Associates is the current recruiting affiliation for searches, not the owner of the technical platform.

This separation is intentional so the product can continue independently if the recruiting affiliation changes later.

## Public experience

### Landing
- JVRecruit brand
- Confidential opportunities
- Search focus
- Current open roles
- About / credibility
- Join My Network
- Contact

### Apply to a role
Creates or matches a Candidate, then creates an Application for the selected Job.

### Join My Network
Creates or matches a Candidate only. It does not create an Application.

## Recruiter experience

Main navigation:

`Dashboard · Jobs · Candidates`

### Job pipeline
`Applied → Prescreen → Submitted → Client Sub → Interviewing → Offer → Placed`

Rejected, Withdrawn and Archived remain searchable but stay outside the main Kanban.

### Candidate Master Profile
One Candidate can participate in many Applications.

Candidate-wide information:
- name
- email
- phone
- LinkedIn
- location
- current title/company
- source
- latest resume
- general notes
- activity

Application-specific information:
- job
- pipeline stage
- interview stage
- application notes
- application activity
- outcome

## Database boundaries

### Internal tables
- recruiters
- jobs
- candidates
- applications
- candidate_notes
- application_notes
- activities
- interviews

### Public-safe table
- job_posts

Client identity and internal search information live in `jobs`. Public copy lives in `job_posts`. This prevents client identity from being leaked through a browser payload even if the public page is inspected.

## Authentication

Candidate accounts are not required for MVP.

Recruiter/admin access uses Supabase Auth. The `recruiters.auth_user_id` field maps an authenticated Supabase user to their recruiter record.

## Authorization

Row Level Security is enabled on all application tables.

Initial MVP:
- authenticated active recruiters can use the internal ATS
- anonymous users can only read published `job_posts`
- anonymous candidate submission should go through a server/Edge Function rather than direct table access

Future:
- Admin
- Recruiter / owner
- Collaborator
- Viewer
- organization / multi-tenant isolation if JVRecruit becomes SaaS

## Files

Resumes use a private Supabase Storage bucket named `resumes`.

The database stores only the object path and resume metadata. Recruiters receive time-limited signed URLs for authorized downloads.

## Environment variables

Browser-safe:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

Server-only:
- SUPABASE_SECRET_KEY

Never expose a secret/service key in client code.
