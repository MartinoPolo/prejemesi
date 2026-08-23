ALTER TABLE "gift_ingestion_item" ADD COLUMN "provenance" jsonb DEFAULT '{}'::jsonb NOT NULL;
