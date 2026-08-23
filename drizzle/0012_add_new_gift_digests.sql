ALTER TABLE "notification" ADD COLUMN "payload" jsonb;
ALTER TABLE "notification" ADD COLUMN "visible_at" timestamp with time zone;
ALTER TABLE "notification" ADD COLUMN "dedupe_key" text;
CREATE UNIQUE INDEX "notification_dedupe_key_unique" ON "notification" USING btree ("dedupe_key") WHERE "notification"."dedupe_key" IS NOT NULL;

CREATE TABLE "new_gift_digest_state" (
	"user_id" text PRIMARY KEY NOT NULL,
	"active_notification_id" text,
	"window_started_at" timestamp with time zone,
	"window_ends_at" timestamp with time zone,
	CONSTRAINT "new_gift_digest_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "new_gift_digest_state_active_notification_id_notification_id_fk" FOREIGN KEY ("active_notification_id") REFERENCES "public"."notification"("id") ON DELETE set null ON UPDATE no action
);
