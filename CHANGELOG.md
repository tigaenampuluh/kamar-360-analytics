# Changelog

All notable production changes to 360 - Center of Research are documented here.

## [1.0.1] - 2026-09-03

### Fixed
- Restored the official 360 - Center of Research browser and PWA metadata.

### Security
- Added a build-time Deployment Guard that rejects an incorrect app identity, repository, or Vercel production target.
- Added production identity headers, a richer health response, an independent CI build check, and a production smoke-check command.
- Excluded temporary Vercel source copies and local environment files from version control and deployment uploads.

## [1.0.0] - 2026-08-30

### Released

- First stable production release of 360 - Center of Research.
- Core workspace flows cover Dashboard, Project Tracker/Kanban, Calendar Planner, Asset & Library, Activity History, member administration, notifications, announcements, project collaboration, version history, backup and recovery, and account security.
- Production acceptance testing on TestSprite completed with 31 of 32 tests passing, no application failures, and one asset-link test blocked by external Canva/Cloudflare verification.

### Changed

- The application version displayed on the login screen, workspace sidebar, and footer is now `v1.0.0`.

## [0.5.1] - 2026-08-30

### Changed

- The Dashboard Deadline & Agenda panel now uses compact, wrapping rows that remain inside their column without horizontal scrolling.
- Project-created, project-update, deadline, and project-linked agenda notifications now go only to the project's PIC and assigned members.
- Standalone agenda notifications now go only to the member whose account name matches the agenda PIC.
- Previously broadcast project/agenda notifications are removed automatically from unrelated users when notifications refresh.

## [0.5.0] - 2026-08-30

### Added

- Admin announcements with priority, optional end time, activation controls, Dashboard banners, and recipient/read counts.
- Two notification categories in one bell: Pengumuman Admin and Task Update.
- Project Version History for Admin/Lead, with field and membership snapshots, up to 100 retained versions, and non-destructive restore.
- Username-based login, automatic usernames for existing members, editable usernames in profiles, and username-based `@mention` labels.
- Licensed credit on the login screen, sidebar, and workspace footer.

### Changed

- Deadline and agenda notifications now use readable Indonesian dates and WIB times instead of raw ISO timestamps such as `T10:00:00.000Z`.
- Workspace backups also preserve announcements and project version snapshots.

## [0.4.0] - 2026-08-29

### Added

- Admin-only workspace backup snapshots, JSON downloads, guarded restoration, and automatic safety backups before every restore.
- Optimistic version checks prevent one user's project edit, archive, deletion, or approval from silently overwriting newer data.
- Mobile Kanban cards now provide a dedicated status and quick-edit action instead of relying on touch drag-and-drop.
- Quick edit supports project status, PIC, deadline, and priority, followed by a seven-second server-backed undo action.
- Installable mobile app metadata and a 360 home-screen icon.

### Changed

- Activity History shows only project-created, project-completed, and project-revision milestones to regular members.
- Admins retain the detailed operational Activity History, including backup activity.

## [0.3.1] - 2026-08-29

### Changed

- Kanban now fits all five status columns in one horizontal desktop row without requiring horizontal scrolling.
- Project cards, status headers, spacing, avatars, priorities, and deadline indicators use a more compact layout.

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

[1.0.1]: https://github.com/gideonlybrium07/ruang-riset/releases/tag/v1.0.1
[1.0.0]: https://github.com/gideonlybrium07/ruang-riset/releases/tag/v1.0.0
[0.5.1]: https://github.com/gideonlybrium07/ruang-riset/releases/tag/v0.5.1
[0.5.0]: https://github.com/gideonlybrium07/ruang-riset/releases/tag/v0.5.0
[0.4.0]: https://github.com/gideonlybrium07/ruang-riset/releases/tag/v0.4.0
[0.3.1]: https://github.com/gideonlybrium07/ruang-riset/releases/tag/v0.3.1
[0.3.0]: https://github.com/gideonlybrium07/ruang-riset/releases/tag/v0.3.0
[0.2.0]: https://github.com/gideonlybrium07/ruang-riset/releases/tag/v0.2.0
[0.1.0]: https://github.com/gideonlybrium07/ruang-riset/releases/tag/v0.1.0
