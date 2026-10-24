ALTER TABLE "gift" ADD COLUMN "category_ids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "gift" ADD CONSTRAINT "gift_category_ids_limit_check" CHECK (cardinality("gift"."category_ids") <= 5);--> statement-breakpoint
UPDATE "gift" SET "category_ids" = ARRAY["category_id"] WHERE "category_id" IS NOT NULL;--> statement-breakpoint
-- Until the contract step drops "category_id": a release that writes only "category_id" replaces
-- the primary category in "category_ids" (null clears them all, as the legacy API does), and
-- "category_id" always mirrors the primary one.
CREATE FUNCTION "gift_category_ids_legacy_mirror"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF TG_OP = 'INSERT' THEN
		IF cardinality(NEW.category_ids) = 0 AND NEW.category_id IS NOT NULL THEN
			NEW.category_ids := ARRAY[NEW.category_id];
		END IF;
	ELSIF NEW.category_id IS DISTINCT FROM OLD.category_id
		AND NEW.category_ids IS NOT DISTINCT FROM OLD.category_ids THEN
		IF NEW.category_id IS NULL THEN
			NEW.category_ids := '{}'::text[];
		ELSE
			NEW.category_ids := array_prepend(
				NEW.category_id,
				array_remove(OLD.category_ids[2:], NEW.category_id)
			);
		END IF;
	END IF;
	NEW.category_id := NEW.category_ids[1];
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "gift_category_ids_legacy_mirror" BEFORE INSERT OR UPDATE ON "gift" FOR EACH ROW EXECUTE FUNCTION "gift_category_ids_legacy_mirror"();
