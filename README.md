# JVRecruit

JVRecruit is a recruiting platform for confidential technical, product, analytics, engineering, and leadership searches.

The product is owned independently as **JVRecruit**. Current searches may be managed through **Towerhill Associates**, but the product and infrastructure are intentionally kept portable.

## Product surfaces

- **Public landing** — brand, search focus, open roles, Join My Network.
- **Open Roles** — confidential public job listings.
- **Candidate applications** — Apply to a Role.
- **Talent network** — Join My Network without applying to a specific role.
- **Recruiter Admin** — Jobs, Candidates, Kanban pipeline, notes, activity, interviews, offers and placements.

## Planned production stack

- Frontend: React / Next.js
- Database: Supabase Postgres
- Auth: Supabase Auth
- Resume storage: Supabase Storage
- Realtime: Supabase Realtime
- Domain: jvrecruiter.xyz
- Source control: this repository

## Candidate model

A person exists once in `candidates`.

A person can have multiple `applications`, one per role. Each application has its own stage, interview step, notes and activity history.

Pipeline:

`Applied → Prescreen → Submitted → Client Sub → Interviewing → Offer → Placed`

## Security model

- Client identities are private and are never stored in public job-post fields.
- Public users can read only published rows from `job_posts`.
- Candidate PII, resumes and internal notes are not directly readable by anonymous users.
- Recruiter data is protected with Row Level Security.
- Resume storage is private.
- Server-side secrets must never be exposed in browser code.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the Supabase migration under [supabase/migrations](supabase/migrations).
