ALTER TABLE "wishlist" DROP CONSTRAINT "wishlist_owner_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "wishlist" DROP COLUMN "owner_id";--> statement-breakpoint
ALTER TABLE "wishlist" DROP COLUMN "owner_is_moderator";