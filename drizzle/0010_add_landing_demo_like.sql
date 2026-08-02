CREATE TABLE "landing_demo_like" (
	"id" text PRIMARY KEY NOT NULL,
	"gift_slug" text NOT NULL,
	"anon_visitor_id" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "landing_demo_like_unique_active" ON "landing_demo_like" USING btree ("gift_slug","anon_visitor_id") WHERE "landing_demo_like"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "landing_demo_like_gift_slug_active_idx" ON "landing_demo_like" USING btree ("gift_slug") WHERE "landing_demo_like"."deleted_at" IS NULL;