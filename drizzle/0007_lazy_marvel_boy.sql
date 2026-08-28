CREATE TABLE "workspace_backups" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"snapshot" jsonb NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"restored_at" timestamp with time zone,
	"restored_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_backups" ADD CONSTRAINT "workspace_backups_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_backups" ADD CONSTRAINT "workspace_backups_restored_by_user_id_fk" FOREIGN KEY ("restored_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_workspace_backups_created_at" ON "workspace_backups" USING btree ("created_at");