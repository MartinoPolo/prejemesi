CREATE TABLE "personal_access_token" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"token_prefix" text NOT NULL,
	"token_hash" text NOT NULL,
	"scopes" text[] NOT NULL,
	"restricted_to_wishlists" boolean DEFAULT false NOT NULL,
	"fast_forward" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rolled_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "personal_access_token_wishlist" (
	"token_id" text NOT NULL,
	"wishlist_id" text NOT NULL,
	CONSTRAINT "personal_access_token_wishlist_token_id_wishlist_id_pk" PRIMARY KEY("token_id","wishlist_id")
);
--> statement-breakpoint
ALTER TABLE "personal_access_token" ADD CONSTRAINT "personal_access_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_access_token_wishlist" ADD CONSTRAINT "personal_access_token_wishlist_token_id_personal_access_token_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."personal_access_token"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_access_token_wishlist" ADD CONSTRAINT "personal_access_token_wishlist_wishlist_id_wishlist_id_fk" FOREIGN KEY ("wishlist_id") REFERENCES "public"."wishlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "personal_access_token_hash_unique" ON "personal_access_token" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "personal_access_token_user_idx" ON "personal_access_token" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "personal_access_token_wishlist_wishlist_idx" ON "personal_access_token_wishlist" USING btree ("wishlist_id");