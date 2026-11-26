CREATE TYPE "public"."gift_link_group_kind" AS ENUM('linked_copies', 'shared_across_recipients');--> statement-breakpoint
CREATE TABLE "gift_link_group" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "gift_link_group_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gift" ADD COLUMN "link_group_id" text;--> statement-breakpoint
ALTER TABLE "gift" ADD CONSTRAINT "gift_link_group_id_gift_link_group_id_fk" FOREIGN KEY ("link_group_id") REFERENCES "public"."gift_link_group"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gift_link_group_idx" ON "gift" USING btree ("link_group_id") WHERE "gift"."link_group_id" IS NOT NULL AND "gift"."deleted_at" IS NULL;