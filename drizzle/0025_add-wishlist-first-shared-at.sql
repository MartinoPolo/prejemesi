ALTER TABLE "wishlist" ADD COLUMN "first_shared_at" timestamp with time zone;--> statement-breakpoint
UPDATE "wishlist" SET "first_shared_at" = "shared_at" WHERE "shared_at" IS NOT NULL;
