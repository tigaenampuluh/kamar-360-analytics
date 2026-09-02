CREATE TABLE "engagement_platform_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"username" text,
	"profile_url" text,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"status" text DEFAULT 'connected' NOT NULL,
	"last_connected_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "engagement_platform_connections" ADD CONSTRAINT "engagement_platform_connections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_engagement_connections_user_platform" ON "engagement_platform_connections" USING btree ("user_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_engagement_connections_platform_account" ON "engagement_platform_connections" USING btree ("platform","provider_account_id");--> statement-breakpoint
CREATE INDEX "idx_engagement_connections_user_status" ON "engagement_platform_connections" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_engagement_connections_checked_at" ON "engagement_platform_connections" USING btree ("last_checked_at");