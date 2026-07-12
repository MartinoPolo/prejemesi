-- expand-contract: contract phase of the recipient role model (issue #99). The expand
-- migration (0003) backfilled recipient_user_id/moderator assignments and the app release
-- deployed with it stopped reading owner_id/owner_is_moderator before this contract ran.
ALTER TABLE "wishlist" DROP CONSTRAINT "wishlist_owner_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "wishlist" DROP COLUMN "owner_id";--> statement-breakpoint
ALTER TABLE "wishlist" DROP COLUMN "owner_is_moderator";