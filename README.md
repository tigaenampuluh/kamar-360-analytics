# Ruang Riset

Full-stack research workspace built with Next.js App Router, Tailwind CSS, shadcn-style components, Better Auth, Drizzle ORM, and PostgreSQL.

## Local setup

1. Start PostgreSQL and create a database named `ruang_riset`. For the included local database on custom host port `55432`, run `docker compose up -d`.
2. Copy `.env.example` to `.env.local`, set `DATABASE_URL` to your PostgreSQL connection string, and replace `BETTER_AUTH_SECRET` with at least 32 random characters.
3. Install dependencies with `pnpm install`.
4. Apply migrations with `pnpm db:migrate`.
5. Add representative workspace data with `pnpm db:seed`.
6. Start the app with `pnpm dev`.

The first user can register from the sign-up form. Email/password sessions are managed by Better Auth.

## Production access controls

- Set `ALLOWED_SIGNUP_EMAILS` to a comma-separated list of approved member emails. In production, sign-up is denied when the list is empty or the submitted email is not listed.
- Set `ADMIN_EMAILS` to the initial administrator email(s). Administrators can manage future registration access from **Admin Anggota** without redeploying.
- Permintaan lupa password masuk ke **Admin Anggota**. Admin menetapkan password sementara secara manual, lalu menyampaikannya kepada anggota melalui kanal internal yang aman. Seluruh sesi lama anggota otomatis dicabut.
- Set `NEXT_PUBLIC_ENABLE_DEMO=false` to remove the mock-data demo entry point from the production login screen.
- Store `DATABASE_URL` and `BETTER_AUTH_SECRET` as sensitive environment variables, and set `BETTER_AUTH_URL` to the exact HTTPS production origin.
- Apply database migrations before opening the production application. Seed data is intended for local/demo environments and should not be applied to a clean production workspace unless explicitly desired.

## API routes

- `GET|POST /api/auth/[...all]` — Better Auth handler
- `GET|POST /api/projects` — search/list and create projects
- `GET|PATCH|DELETE /api/projects/:id` — project detail and mutations
- `GET|POST /api/agendas` — list and create calendar agendas
- `PATCH|DELETE /api/agendas/:id` — agenda mutations
- `GET|POST /api/assets` — search/list and create archived assets
- `GET|PATCH|DELETE /api/assets/:id` — asset detail and mutations
- `GET /api/activity` — filterable activity history
- `GET /api/dashboard` — dashboard aggregates
- `GET|PATCH /api/notifications` — list notifications and mark all as read
- `PATCH /api/notifications/:id` — mark one notification as read
- `POST /api/password-recovery` — submit a manual password-reset request
- `GET /api/admin/password-resets` — list pending reset requests (admin only)
- `PATCH /api/admin/password-resets/:id` — set a temporary password and revoke sessions (admin only)
- `GET /api/health` — database health check

All workspace routes except health and authentication require a valid Better Auth session. Project changes automatically create activity records, and moving a project to `Done` creates its archive entry.

The schema uses timezone-aware timestamps, JSONB asset tags, foreign keys, and indexes for the primary project, calendar, archive, authentication, and activity queries.
