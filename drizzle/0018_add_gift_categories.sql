CREATE TABLE "gift_category" (
	"id" text PRIMARY KEY NOT NULL,
	"wishlist_id" text NOT NULL,
	"preset_key" text,
	"custom_label" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gift_category_kind_check" CHECK (num_nonnulls("gift_category"."preset_key", "gift_category"."custom_label") = 1),
	CONSTRAINT "gift_category_custom_label_nonblank_check" CHECK ("gift_category"."custom_label" IS NULL OR btrim("gift_category"."custom_label") <> ''),
	CONSTRAINT "gift_category_preset_key_check" CHECK ("gift_category"."preset_key" IS NULL OR "gift_category"."preset_key" IN ('games', 'toys', 'books', 'clothing', 'electronics', 'home', 'experiences', 'subscriptions', 'personal-care'))
);
--> statement-breakpoint
ALTER TABLE "gift" ADD COLUMN "category_id" text;
--> statement-breakpoint
ALTER TABLE "gift_category" ADD CONSTRAINT "gift_category_wishlist_id_wishlist_id_fk" FOREIGN KEY ("wishlist_id") REFERENCES "public"."wishlist"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "gift_category_wishlist_id_id_unique" ON "gift_category" USING btree ("wishlist_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "gift_category_active_preset_unique" ON "gift_category" USING btree ("wishlist_id","preset_key") WHERE "gift_category"."deleted_at" IS NULL AND "gift_category"."preset_key" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "gift_category_active_custom_label_unique" ON "gift_category" USING btree ("wishlist_id",lower(btrim("custom_label"))) WHERE "gift_category"."deleted_at" IS NULL AND "gift_category"."custom_label" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "gift_category_active_order_idx" ON "gift_category" USING btree ("wishlist_id","sort_order") WHERE "gift_category"."deleted_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "gift" ADD CONSTRAINT "gift_wishlist_category_fk" FOREIGN KEY ("wishlist_id","category_id") REFERENCES "public"."gift_category"("wishlist_id","id") ON DELETE no action ON UPDATE no action;
