CREATE TABLE "demo_client_throttle" (
	"client_hash" text PRIMARY KEY NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"creations" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_session" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"viewer_user_id" text NOT NULL,
	"client_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"edit_requests" integer DEFAULT 0 NOT NULL,
	"resets" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "demo_session_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "demo_session_id" text;--> statement-breakpoint
ALTER TABLE "wishlist" ADD COLUMN "demo_session_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_demo_session_id_demo_session_id_fk" FOREIGN KEY ("demo_session_id") REFERENCES "public"."demo_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_demo_session_id_demo_session_id_fk" FOREIGN KEY ("demo_session_id") REFERENCES "public"."demo_session"("id") ON DELETE cascade ON UPDATE no action;