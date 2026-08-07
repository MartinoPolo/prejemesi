CREATE TABLE "wishlist_visit" (
	"user_id" text NOT NULL,
	"wishlist_id" text NOT NULL,
	"last_visited_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wishlist_visit_user_id_wishlist_id_pk" PRIMARY KEY("user_id","wishlist_id")
);
--> statement-breakpoint
ALTER TABLE "wishlist_visit" ADD CONSTRAINT "wishlist_visit_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_visit" ADD CONSTRAINT "wishlist_visit_wishlist_id_wishlist_id_fk" FOREIGN KEY ("wishlist_id") REFERENCES "public"."wishlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wishlist_visit_user_idx" ON "wishlist_visit" USING btree ("user_id");