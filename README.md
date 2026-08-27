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
- `GET /api/health` — database health check

All workspace routes except health and authentication require a valid Better Auth session. Project changes automatically create activity records, and moving a project to `Done` creates its archive entry.

The schema uses timezone-aware timestamps, JSONB asset tags, foreign keys, and indexes for the primary project, calendar, archive, authentication, and activity queries.
