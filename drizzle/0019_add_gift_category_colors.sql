ALTER TABLE "gift_category" ADD COLUMN "color" text;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "gift_category_fill_legacy_color_on_insert_0019"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF NEW."color" IS NOT NULL THEN
		RETURN NEW;
	END IF;

	IF NEW."preset_key" IS NOT NULL THEN
		NEW."color" := CASE NEW."preset_key"
			WHEN 'games' THEN '#7C3AED'
			WHEN 'toys' THEN '#D97706'
			WHEN 'books' THEN '#2563EB'
			WHEN 'clothing' THEN '#DB2777'
			WHEN 'electronics' THEN '#0F766E'
			WHEN 'home' THEN '#B45309'
			WHEN 'experiences' THEN '#15803D'
			WHEN 'subscriptions' THEN '#6D28D9'
			WHEN 'personal-care' THEN '#BE185D'
		END;
	ELSE
		PERFORM pg_advisory_xact_lock(hashtext(NEW."wishlist_id"), hashtext('gift_category_legacy_color_insert_0019'));
		NEW."color" := (ARRAY[
			'#0369A1', '#047857', '#A21CAF', '#C2410C',
			'#4F46E5', '#B91C1C', '#0F766E', '#7E22CE'
		])[((
			SELECT count(*)::int
			FROM "gift_category"
			WHERE "wishlist_id" = NEW."wishlist_id"
				AND "preset_key" IS NULL
		) % 8) + 1];
	END IF;

	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "gift_category_fill_legacy_color_before_insert_0019"
BEFORE INSERT ON "gift_category"
FOR EACH ROW
EXECUTE FUNCTION "gift_category_fill_legacy_color_on_insert_0019"();
--> statement-breakpoint
UPDATE "gift_category"
SET "color" = CASE "preset_key"
	WHEN 'games' THEN '#7C3AED'
	WHEN 'toys' THEN '#D97706'
	WHEN 'books' THEN '#2563EB'
	WHEN 'clothing' THEN '#DB2777'
	WHEN 'electronics' THEN '#0F766E'
	WHEN 'home' THEN '#B45309'
	WHEN 'experiences' THEN '#15803D'
	WHEN 'subscriptions' THEN '#6D28D9'
	WHEN 'personal-care' THEN '#BE185D'
END
WHERE "preset_key" IS NOT NULL;
--> statement-breakpoint
WITH ranked_custom_categories AS (
	SELECT "id", row_number() OVER (
		PARTITION BY "wishlist_id"
		ORDER BY "created_at", "id"
	) - 1 AS palette_index
	FROM "gift_category"
	WHERE "preset_key" IS NULL
)
UPDATE "gift_category" AS category
SET "color" = (ARRAY[
	'#0369A1', '#047857', '#A21CAF', '#C2410C',
	'#4F46E5', '#B91C1C', '#0F766E', '#7E22CE'
])[(ranked.palette_index % 8) + 1]
FROM ranked_custom_categories AS ranked
WHERE category."id" = ranked."id";
--> statement-breakpoint
UPDATE "gift_category" SET "color" = '#0369A1' WHERE "color" IS NULL;
--> statement-breakpoint
ALTER TABLE "gift_category" ALTER COLUMN "color" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "gift_category" ADD CONSTRAINT "gift_category_color_hex_check" CHECK ("gift_category"."color" ~ '^#[0-9A-Fa-f]{6}$');
