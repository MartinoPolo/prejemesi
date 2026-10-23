ALTER TABLE "wishlist" ADD COLUMN "theme_id" text;--> statement-breakpoint
ALTER TABLE "wishlist" ADD COLUMN "style_tokens" jsonb;--> statement-breakpoint
ALTER TABLE "wishlist" ADD COLUMN "background" jsonb;