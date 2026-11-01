CREATE TABLE "gift_image" (
	"id" text PRIMARY KEY NOT NULL,
	"gift_id" text NOT NULL,
	"position" integer NOT NULL,
	"image_url" text,
	"image_key" text,
	"image_meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gift_image_position_range_check" CHECK ("gift_image"."position" >= 0 AND "gift_image"."position" < 8),
	CONSTRAINT "gift_image_source_check" CHECK (num_nonnulls("gift_image"."image_url", "gift_image"."image_key") >= 1)
);
--> statement-breakpoint
ALTER TABLE "gift_image" ADD CONSTRAINT "gift_image_gift_id_gift_id_fk" FOREIGN KEY ("gift_id") REFERENCES "public"."gift"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gift_image_gift_position_unique" ON "gift_image" USING btree ("gift_id","position");--> statement-breakpoint
CREATE INDEX "gift_image_image_key_idx" ON "gift_image" USING btree ("image_key") WHERE "gift_image"."image_key" IS NOT NULL;--> statement-breakpoint
-- Gift writes wait from the backfill until the cover-mirror trigger exists, so a cover the previous
-- release writes in between cannot miss the gallery. The lock lasts until the migration commits.
LOCK TABLE "gift" IN SHARE ROW EXCLUSIVE MODE;--> statement-breakpoint
-- Every gift with an image, soft-deleted ones included (undo restores them), starts with that
-- image as its one-image gallery.
INSERT INTO "gift_image" ("id", "gift_id", "position", "image_url", "image_key", "image_meta")
SELECT gen_random_uuid()::text, "id", 0, "image_url", "image_key", "image_meta"
FROM "gift"
WHERE "image_url" IS NOT NULL OR "image_key" IS NOT NULL;--> statement-breakpoint
-- "gift"."image_*" stays the cover (position 0). During the migrate-to-deploy window the previous
-- release writes only those columns, so a cover write replaces position 0 and keeps the later
-- images, and clearing the cover clears the whole gallery, as removing the image did before. The
-- current application writes the gallery and the cover columns together, which leaves this a no-op.
CREATE FUNCTION "gift_image_cover_mirror"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF NEW."image_url" IS NULL AND NEW."image_key" IS NULL THEN
		DELETE FROM "gift_image" WHERE "gift_id" = NEW."id";
	ELSE
		INSERT INTO "gift_image" ("id", "gift_id", "position", "image_url", "image_key", "image_meta")
		VALUES (gen_random_uuid()::text, NEW."id", 0, NEW."image_url", NEW."image_key", NEW."image_meta")
		ON CONFLICT ("gift_id", "position") DO UPDATE SET
			"image_url" = EXCLUDED."image_url",
			"image_key" = EXCLUDED."image_key",
			"image_meta" = EXCLUDED."image_meta",
			"updated_at" = now()
		WHERE ("gift_image"."image_url", "gift_image"."image_key", "gift_image"."image_meta")
			IS DISTINCT FROM (EXCLUDED."image_url", EXCLUDED."image_key", EXCLUDED."image_meta");
	END IF;
	RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "gift_image_cover_mirror" AFTER INSERT OR UPDATE OF "image_url", "image_key", "image_meta" ON "gift" FOR EACH ROW EXECUTE FUNCTION "gift_image_cover_mirror"();
