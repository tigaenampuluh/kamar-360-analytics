CREATE TABLE "engagement_contents" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"profile_url" text NOT NULL,
	"username" text NOT NULL,
	"external_id" text NOT NULL,
	"content_type" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"shares" integer,
	"engagement_rate" real DEFAULT 0 NOT NULL,
	"is_best" boolean DEFAULT false NOT NULL,
	"unavailable_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text DEFAULT 'mock' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_engagement_contents_profile_external" ON "engagement_contents" USING btree ("profile_url","external_id");--> statement-breakpoint
CREATE INDEX "idx_engagement_contents_profile_published" ON "engagement_contents" USING btree ("profile_url","published_at");--> statement-breakpoint
CREATE INDEX "idx_engagement_contents_platform_type" ON "engagement_contents" USING btree ("platform","content_type");