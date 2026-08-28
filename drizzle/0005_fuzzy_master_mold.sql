CREATE TABLE "project_comment_mentions" (
	"comment_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_comment_mentions_comment_id_user_id_pk" PRIMARY KEY("comment_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "project_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_completion_approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"requested_by" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"request_note" text DEFAULT '' NOT NULL,
	"reviewed_by" text,
	"review_note" text DEFAULT '' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "project_memberships" (
	"project_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'Anggota' NOT NULL,
	"added_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_memberships_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "primary_pic_user_id" text;--> statement-breakpoint
ALTER TABLE "project_comment_mentions" ADD CONSTRAINT "project_comment_mentions_comment_id_project_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."project_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_comment_mentions" ADD CONSTRAINT "project_comment_mentions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_completion_approvals" ADD CONSTRAINT "project_completion_approvals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_completion_approvals" ADD CONSTRAINT "project_completion_approvals_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_completion_approvals" ADD CONSTRAINT "project_completion_approvals_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_memberships" ADD CONSTRAINT "project_memberships_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_memberships" ADD CONSTRAINT "project_memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_memberships" ADD CONSTRAINT "project_memberships_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_project_comment_mentions_user_id" ON "project_comment_mentions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_project_comments_project_created" ON "project_comments" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_project_comments_author_id" ON "project_comments" USING btree ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_project_completion_approvals_pending" ON "project_completion_approvals" USING btree ("project_id") WHERE "project_completion_approvals"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "idx_project_completion_approvals_project_requested" ON "project_completion_approvals" USING btree ("project_id","requested_at");--> statement-breakpoint
CREATE INDEX "idx_project_completion_approvals_requested_by" ON "project_completion_approvals" USING btree ("requested_by");--> statement-breakpoint
CREATE INDEX "idx_project_memberships_user_id" ON "project_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_project_memberships_project_role" ON "project_memberships" USING btree ("project_id","role");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_primary_pic_user_id_user_id_fk" FOREIGN KEY ("primary_pic_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_projects_primary_pic_user_id" ON "projects" USING btree ("primary_pic_user_id");--> statement-breakpoint
UPDATE "projects" AS p
SET "primary_pic_user_id" = u."id"
FROM "user" AS u
WHERE lower(trim(p."pic")) = lower(trim(u."name"))
  AND p."primary_pic_user_id" IS NULL;--> statement-breakpoint
INSERT INTO "project_memberships" ("project_id", "user_id", "role", "added_by")
SELECT p."id", p."primary_pic_user_id", 'Lead', p."primary_pic_user_id"
FROM "projects" AS p
WHERE p."primary_pic_user_id" IS NOT NULL
ON CONFLICT ("project_id", "user_id") DO NOTHING;
