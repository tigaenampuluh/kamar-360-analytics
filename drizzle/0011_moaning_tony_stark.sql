CREATE TABLE "engagement_analysis_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"platform" text NOT NULL,
	"profile_url" text NOT NULL,
	"username" text NOT NULL,
	"followers_count" integer DEFAULT 0 NOT NULL,
	"followers_change_percent" real DEFAULT 0 NOT NULL,
	"content_count" integer DEFAULT 0 NOT NULL,
	"er_average" real DEFAULT 0 NOT NULL,
	"er_median" real DEFAULT 0 NOT NULL,
	"er_weighted" real DEFAULT 0 NOT NULL,
	"total_interactions" integer DEFAULT 0 NOT NULL,
	"total_views" integer DEFAULT 0 NOT NULL,
	"unavailable_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text DEFAULT 'mock' NOT NULL,
	"analyzed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "engagement_analysis_history" ADD CONSTRAINT "engagement_analysis_history_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_engagement_history_user_analyzed" ON "engagement_analysis_history" USING btree ("user_id","analyzed_at");--> statement-breakpoint
CREATE INDEX "idx_engagement_history_profile_analyzed" ON "engagement_analysis_history" USING btree ("profile_url","analyzed_at");--> statement-breakpoint
CREATE INDEX "idx_engagement_history_platform_analyzed" ON "engagement_analysis_history" USING btree ("platform","analyzed_at");