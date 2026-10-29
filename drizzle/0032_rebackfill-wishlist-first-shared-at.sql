-- Re-runs the 0025 backfill: the previous app kept sharing wishlists after 0025 ran without setting first_shared_at.
UPDATE "wishlist" SET "first_shared_at" = "shared_at" WHERE "first_shared_at" IS NULL AND "shared_at" IS NOT NULL;
