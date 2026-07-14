CREATE TABLE "claim_invite" (
	"id" text PRIMARY KEY NOT NULL,
	"wishlist_id" text NOT NULL,
	"token" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"used_by_user_id" text,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claim_invite_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "wishlist" DROP CONSTRAINT "wishlist_recipient_presence_check";--> statement-breakpoint
ALTER TABLE "claim_invite" ADD CONSTRAINT "claim_invite_wishlist_id_wishlist_id_fk" FOREIGN KEY ("wishlist_id") REFERENCES "public"."wishlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_invite" ADD CONSTRAINT "claim_invite_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_invite" ADD CONSTRAINT "claim_invite_used_by_user_id_user_id_fk" FOREIGN KEY ("used_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "claim_invite_wishlist_idx" ON "claim_invite" USING btree ("wishlist_id");--> statement-breakpoint
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_recipient_presence_check" CHECK (num_nonnulls("wishlist"."recipient_user_id", "wishlist"."recipient_name") = 1);