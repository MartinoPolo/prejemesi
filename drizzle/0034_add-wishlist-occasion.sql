CREATE TYPE "public"."wishlist_occasion" AS ENUM('christmas', 'birthday', 'name_day', 'wedding', 'baby', 'graduation', 'other', 'permanent');--> statement-breakpoint
ALTER TABLE "wishlist" ADD COLUMN "occasion" "wishlist_occasion" DEFAULT 'other' NOT NULL;--> statement-breakpoint
-- The column's exclusive lock holds until the migration commits, so the previous release cannot
-- write a wishlist between this backfill and the trigger below. Every row is backfilled, soft-deleted
-- ones included: permanent lists are the Stálý seznam; lists dated 24. 12. on the Prague calendar or
-- using the Christmas motif are Vánoce; the rest keep the default, Jiná.
UPDATE "wishlist" SET "occasion" = 'permanent' WHERE "kind" = 'permanent';--> statement-breakpoint
UPDATE "wishlist" SET "occasion" = 'christmas'
WHERE "kind" <> 'permanent'
	AND (
		"theme_id" = 'christmas'
		OR to_char("event_date" AT TIME ZONE 'Europe/Prague', 'MM-DD') = '12-24'
	);--> statement-breakpoint
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_occasion_kind_check" CHECK (("wishlist"."occasion" = 'permanent') = ("wishlist"."kind" = 'permanent'));--> statement-breakpoint
-- The previous release writes only "kind": an insert or update of it alone moves the occasion along.
-- Becoming permanent makes it the Stálý seznam; leaving permanent makes it Jiná. The current
-- application writes both columns together, which leaves this a no-op.
CREATE FUNCTION "wishlist_occasion_kind_mirror"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF TG_OP = 'INSERT' THEN
		IF NEW.kind = 'permanent' THEN
			NEW.occasion := 'permanent';
		END IF;
	ELSIF NEW.kind IS DISTINCT FROM OLD.kind AND NEW.occasion IS NOT DISTINCT FROM OLD.occasion THEN
		IF NEW.kind = 'permanent' THEN
			NEW.occasion := 'permanent';
		ELSIF OLD.occasion = 'permanent' THEN
			NEW.occasion := 'other';
		END IF;
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "wishlist_occasion_kind_mirror" BEFORE INSERT OR UPDATE OF "kind" ON "wishlist" FOR EACH ROW EXECUTE FUNCTION "wishlist_occasion_kind_mirror"();
