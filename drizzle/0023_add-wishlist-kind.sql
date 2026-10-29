CREATE TYPE "public"."wishlist_kind" AS ENUM('occasion', 'permanent');--> statement-breakpoint
ALTER TABLE "wishlist" ADD COLUMN "kind" "wishlist_kind" DEFAULT 'occasion' NOT NULL;