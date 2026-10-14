CREATE TABLE "gift_revision" (
	"id" text PRIMARY KEY NOT NULL,
	"gift_id" text NOT NULL,
	"wishlist_id" text NOT NULL,
	"batch_id" text NOT NULL,
	"actor_user_id" text,
	"channel" text NOT NULL,
	"operation" text NOT NULL,
	"before" jsonb,
	"after" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gift_revision" ADD CONSTRAINT "gift_revision_gift_id_gift_id_fk" FOREIGN KEY ("gift_id") REFERENCES "public"."gift"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_revision" ADD CONSTRAINT "gift_revision_wishlist_id_wishlist_id_fk" FOREIGN KEY ("wishlist_id") REFERENCES "public"."wishlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_revision" ADD CONSTRAINT "gift_revision_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gift_revision_gift_latest_idx" ON "gift_revision" USING btree ("gift_id","created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "gift_revision_batch_idx" ON "gift_revision" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "gift_revision_created_idx" ON "gift_revision" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "gift_revision_wishlist_created_idx" ON "gift_revision" USING btree ("wishlist_id","created_at");--> statement-breakpoint
CREATE INDEX "gift_revision_actor_user_idx" ON "gift_revision" USING btree ("actor_user_id");