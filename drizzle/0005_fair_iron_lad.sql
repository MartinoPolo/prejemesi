CREATE TYPE "public"."palette" AS ENUM('sky', 'mint', 'peach', 'grape', 'sakura', 'ocean', 'honey', 'ruby', 'matcha', 'graphite');--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "palette" "palette" DEFAULT 'sky' NOT NULL;--> statement-breakpoint
ALTER TABLE "wishlist" ADD COLUMN "palette" "palette" DEFAULT 'sky' NOT NULL;--> statement-breakpoint
-- Backfill (Redesign 2026): map existing wishlist rows off the legacy theme axes onto
-- the new palette. `theme = 'default'` intentionally keeps the column default ('sky').
-- Preset themes map 1:1.
UPDATE "wishlist" SET "palette" = (CASE "theme"
		WHEN 'christmas' THEN 'ruby'
		WHEN 'birthday' THEN 'sakura'
		WHEN 'fun' THEN 'honey'
		WHEN 'elegant' THEN 'graphite'
	END)::"palette"
	WHERE "theme" IN ('christmas', 'birthday', 'fun', 'elegant');--> statement-breakpoint
-- Custom-color rows: bucket the stored hex into the nearest palette by HSL hue.
-- Near-greys (chroma < 30 on the 0-255 max-min scale) collapse to graphite.
UPDATE "wishlist" AS w SET "palette" = (CASE
		WHEN c.chroma < 30 THEN 'graphite'
		WHEN c.hue < 15 OR c.hue >= 340 THEN 'ruby'
		WHEN c.hue < 45 THEN 'peach'
		WHEN c.hue < 70 THEN 'honey'
		WHEN c.hue < 110 THEN 'matcha'
		WHEN c.hue < 160 THEN 'mint'
		WHEN c.hue < 200 THEN 'ocean'
		WHEN c.hue < 235 THEN 'sky'
		WHEN c.hue < 290 THEN 'grape'
		ELSE 'sakura'
	END)::"palette"
	FROM (
		SELECT
			id,
			greatest(r, g, b) - least(r, g, b) AS chroma,
			CASE
				WHEN greatest(r, g, b) = least(r, g, b) THEN 0
				WHEN greatest(r, g, b) = r
					THEN (60 * ((g - b)::numeric / (greatest(r, g, b) - least(r, g, b))) + 360) % 360
				WHEN greatest(r, g, b) = g
					THEN 60 * ((b - r)::numeric / (greatest(r, g, b) - least(r, g, b))) + 120
				ELSE 60 * ((r - g)::numeric / (greatest(r, g, b) - least(r, g, b))) + 240
			END AS hue
		FROM (
			SELECT
				id,
				('x' || substr(lower(custom_theme_color), 2, 2))::bit(8)::int AS r,
				('x' || substr(lower(custom_theme_color), 4, 2))::bit(8)::int AS g,
				('x' || substr(lower(custom_theme_color), 6, 2))::bit(8)::int AS b
			FROM "wishlist"
			WHERE "theme" = 'custom'
				AND custom_theme_color ~* '^#[0-9a-f]{6}$'
		) rgb
	) c
	WHERE w.id = c.id;