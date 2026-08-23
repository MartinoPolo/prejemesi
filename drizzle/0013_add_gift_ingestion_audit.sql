CREATE TABLE "gift_ingestion_run" (
	"id" text PRIMARY KEY NOT NULL,
	"manifest_id" text NOT NULL,
	"wishlist_id" text NOT NULL,
	"manifest_hash" text NOT NULL,
	"status" text NOT NULL,
	"result" jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gift_ingestion_run_wishlist_id_wishlist_id_fk" FOREIGN KEY ("wishlist_id") REFERENCES "public"."wishlist"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "gift_ingestion_run_manifest_unique" ON "gift_ingestion_run" USING btree ("manifest_id");
--> statement-breakpoint
CREATE INDEX "gift_ingestion_run_wishlist_started_idx" ON "gift_ingestion_run" USING btree ("wishlist_id", "started_at");
--> statement-breakpoint
CREATE TABLE "gift_ingestion_item" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"item_id" text NOT NULL,
	"source_url" text NOT NULL,
	"item_hash" text NOT NULL,
	"created_gift_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gift_ingestion_item_run_id_gift_ingestion_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."gift_ingestion_run"("id"),
	CONSTRAINT "gift_ingestion_item_created_gift_id_gift_id_fk" FOREIGN KEY ("created_gift_id") REFERENCES "public"."gift"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "gift_ingestion_item_item_unique" ON "gift_ingestion_item" USING btree ("item_id");
--> statement-breakpoint
CREATE INDEX "gift_ingestion_item_run_idx" ON "gift_ingestion_item" USING btree ("run_id");
