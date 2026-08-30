CREATE TABLE "announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"priority" text DEFAULT 'info' NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"changes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"action" text DEFAULT 'update' NOT NULL,
	"created_by" text,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "announcement_id" integer;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "username" text;--> statement-breakpoint
DO $$
DECLARE
  member record;
  base_username text;
  candidate text;
  suffix integer;
BEGIN
  FOR member IN SELECT id, email FROM "user" ORDER BY created_at, id LOOP
    base_username := trim(both '.' from regexp_replace(lower(split_part(member.email, '@', 1)), '[^a-z0-9._]+', '.', 'g'));
    IF length(base_username) < 3 THEN
      base_username := 'user';
    END IF;
    base_username := left(base_username, 30);
    candidate := base_username;
    suffix := 1;
    WHILE EXISTS (SELECT 1 FROM "user" WHERE username = candidate AND id <> member.id) LOOP
      suffix := suffix + 1;
      candidate := left(base_username, 30 - length(suffix::text) - 1) || '.' || suffix::text;
    END LOOP;
    UPDATE "user" SET username = candidate WHERE id = member.id;
  END LOOP;
END $$;--> statement-breakpoint
INSERT INTO "project_versions" ("project_id", "version", "snapshot", "changes", "action", "created_by_name", "created_at")
SELECT
  p.id,
  p.version,
  jsonb_build_object(
    'title', p.title,
    'description', p.description,
    'pic', p.pic,
    'picInitials', p.pic_initials,
    'primaryPicUserId', p.primary_pic_user_id,
    'deadline', p.deadline,
    'doneAt', p.done_at,
    'status', p.status,
    'priority', p.priority,
    'category', p.category,
    'workingDocLink', p.working_doc_link,
    'archivedAt', p.archived_at,
    'members', coalesce((
      SELECT jsonb_agg(jsonb_build_object('userId', pm.user_id, 'role', pm.role) ORDER BY pm.user_id)
      FROM project_memberships pm
      WHERE pm.project_id = p.id
    ), '[]'::jsonb)
  ),
  '["Baseline sebelum v0.5.0"]'::jsonb,
  'update',
  'Sistem (migrasi v0.5.0)',
  p.updated_at
FROM projects p;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_versions" ADD CONSTRAINT "project_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_versions" ADD CONSTRAINT "project_versions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_announcements_active_period" ON "announcements" USING btree ("active","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "idx_announcements_created_at" ON "announcements" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_project_versions_project_version" ON "project_versions" USING btree ("project_id","version");--> statement-breakpoint
CREATE INDEX "idx_project_versions_project_created" ON "project_versions" USING btree ("project_id","created_at");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notifications_announcement_id" ON "notifications" USING btree ("announcement_id");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_username_unique" UNIQUE("username");
