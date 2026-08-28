# Changelog

All notable production changes to 360 - Center of Research are documented here.

## [0.3.0] - 2026-08-28

### Added

- Global database-backed search across projects, comments, agendas, and assets.
- Recoverable project archives with permission-aware archive and restore actions.
- Active-session management from the member profile.
- Database-backed authentication rate limiting and production security headers.

### Changed

- Archived projects are excluded from active dashboards, calendar data, and Kanban counts.
- Archived projects are read-only until restored.

## [0.2.0] - 2026-08-28

### Added

- Account-based PIC selection with a manual PIC fallback.
- Multiple project members with Lead, Anggota, and Viewer roles; workspace administrators retain Admin access.
- Project comments, explicit `@mention` recipients, and targeted assignment/mention notifications.
- Completion approval flow: Anggota requests Done, while Lead/Admin reviews or completes directly.
- Member avatars and roles on Kanban cards and project details.

### Changed

- Project editing, deletion, comments, and Kanban movement now follow project-level permissions.
- Sessions now expire when the last 360 tab is closed and later reopened, or when no 360 tab is visible for 10 minutes; refresh and other open 360 tabs keep the session active.

## [0.1.0] - 2026-08-28

First formally versioned production baseline.

### Added

- Dashboard, Project Tracker/Kanban, Calendar Planner, Asset Library, and Activity History.
- PostgreSQL-backed project, agenda, asset, activity, notification, profile, and administration APIs.
- Member registration controls, admin invitations, manual password recovery, and self-service password changes.
- Active-member presence, synchronized profile avatars, in-app notifications, and WIB-aware dashboard greetings.
- Production branding, browser icons, responsive layout, demo mode, and Vercel deployment.

### Changed

- Project data and dashboard counts now stay synchronized across the main workspace views.
- Login sessions end when the browser closes or after 10 minutes without activity.

[0.3.0]: https://github.com/gideonlybrium07/ruang-riset/releases/tag/v0.3.0
[0.2.0]: https://github.com/gideonlybrium07/ruang-riset/releases/tag/v0.2.0
[0.1.0]: https://github.com/gideonlybrium07/ruang-riset/releases/tag/v0.1.0
