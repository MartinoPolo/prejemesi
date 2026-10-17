CREATE TABLE "agent_image" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"wishlist_id" text NOT NULL,
	"token_id" text,
	"object_key" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_length" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attached_at" timestamp with time zone,
	CONSTRAINT "agent_image_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
ALTER TABLE "agent_image" ADD CONSTRAINT "agent_image_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_image" ADD CONSTRAINT "agent_image_wishlist_id_wishlist_id_fk" FOREIGN KEY ("wishlist_id") REFERENCES "public"."wishlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_image" ADD CONSTRAINT "agent_image_token_id_personal_access_token_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."personal_access_token"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_image_user_created_idx" ON "agent_image" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_image_expires_idx" ON "agent_image" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "agent_image_attached_idx" ON "agent_image" USING btree ("attached_at");--> statement-breakpoint
CREATE INDEX "agent_image_wishlist_idx" ON "agent_image" USING btree ("wishlist_id");--> statement-breakpoint
CREATE INDEX "agent_image_token_idx" ON "agent_image" USING btree ("token_id");--> statement-breakpoint
CREATE INDEX "gift_image_key_idx" ON "gift" USING btree ("image_key") WHERE "gift"."image_key" IS NOT NULL;