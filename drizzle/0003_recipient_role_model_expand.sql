ALTER TABLE "wishlist" ADD COLUMN "recipient_user_id" text;--> statement-breakpoint
ALTER TABLE "wishlist" ADD COLUMN "recipient_name" text;--> statement-breakpoint
ALTER TABLE "wishlist" ADD COLUMN "recipient_is_moderator" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Backfill: existing lists become self-recipient (former owner → linked recipient;
-- owner-is-moderator flag → recipient-is-správce). Runs before the presence CHECK so
-- existing rows satisfy it. Existing moderator_assignment rows stay untouched.
UPDATE "wishlist" SET "recipient_user_id" = "owner_id", "recipient_is_moderator" = "owner_is_moderator";--> statement-breakpoint
CREATE INDEX "wishlist_recipient_status_idx" ON "wishlist" USING btree ("recipient_user_id","status") WHERE "wishlist"."deleted_at" IS NULL;--> statement-breakpoint
DROP INDEX "wishlist_owner_status_idx";--> statement-breakpoint
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_recipient_presence_check" CHECK ("wishlist"."recipient_user_id" IS NOT NULL OR "wishlist"."recipient_name" IS NOT NULL);
