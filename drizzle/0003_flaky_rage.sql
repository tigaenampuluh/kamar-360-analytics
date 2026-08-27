CREATE TABLE "signup_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"added_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "signup_invites_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "signup_invites" ADD CONSTRAINT "signup_invites_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_signup_invites_revoked_at" ON "signup_invites" USING btree ("revoked_at");