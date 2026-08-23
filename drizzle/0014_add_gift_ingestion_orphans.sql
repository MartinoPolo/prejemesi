CREATE TABLE "gift_ingestion_orphan" (
	"id" text PRIMARY KEY NOT NULL,
	"manifest_id" text NOT NULL,
	"item_id" text NOT NULL,
	"object_key" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "gift_ingestion_orphan_unresolved_idx" ON "gift_ingestion_orphan" USING btree ("resolved_at", "created_at");
