ALTER TABLE "projects" ADD COLUMN "done_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_projects_status_done_at" ON "projects" USING btree ("status","done_at");