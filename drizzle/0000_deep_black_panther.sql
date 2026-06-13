CREATE TYPE "public"."app_background_theme" AS ENUM('default', 'golden-hour', 'twilight');--> statement-breakpoint
CREATE TYPE "public"."wishlist_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."wishlist_theme" AS ENUM('default', 'christmas', 'birthday', 'fun', 'elegant', 'custom');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"app_background_theme" "app_background_theme" DEFAULT 'default' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "priority_level" (
	"id" text PRIMARY KEY NOT NULL,
	"wishlist_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wishlist" (
	"id" text PRIMARY KEY NOT NULL,
	"short_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"event_date" timestamp with time zone,
	"status" "wishlist_status" DEFAULT 'draft' NOT NULL,
	"theme" "wishlist_theme" DEFAULT 'default' NOT NULL,
	"custom_theme_color" text,
	"image_key" text,
	"image_slots" jsonb,
	"owner_is_moderator" boolean DEFAULT false NOT NULL,
	"shared_at" timestamp with time zone,
	"event_date_edited_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wishlist_short_id_unique" UNIQUE("short_id")
);
--> statement-breakpoint
CREATE TABLE "gift" (
	"id" text PRIMARY KEY NOT NULL,
	"wishlist_id" text NOT NULL,
	"priority_level_id" text,
	"name" text NOT NULL,
	"description" text,
	"description_appends" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"edited_after_share_at" timestamp with time zone,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"price" integer,
	"currency" text DEFAULT 'CZK',
	"image_url" text,
	"image_key" text,
	"image_meta" jsonb,
	"quantity" integer DEFAULT 1,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"received" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gift_like" (
	"id" text PRIMARY KEY NOT NULL,
	"gift_id" text NOT NULL,
	"user_id" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservation" (
	"id" text PRIMARY KEY NOT NULL,
	"gift_id" text NOT NULL,
	"user_id" text,
	"anonymous_name" text,
	"anonymous_email" text,
	"anonymous_visitor_id" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"purchased_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderator_assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"wishlist_id" text NOT NULL,
	"user_id" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderator_invite" (
	"id" text PRIMARY KEY NOT NULL,
	"wishlist_id" text NOT NULL,
	"token" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"used_by_user_id" text,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderator_invite_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "wishlist_follower" (
	"wishlist_id" text NOT NULL,
	"user_id" text NOT NULL,
	"last_visited_at" timestamp with time zone,
	"unfollowed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wishlist_follower_wishlist_id_user_id_pk" PRIMARY KEY("wishlist_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"wishlist_id" text,
	"gift_id" text,
	"actor_id" text,
	"actor_name" text,
	"read" boolean DEFAULT false NOT NULL,
	"email_sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "priority_level" ADD CONSTRAINT "priority_level_wishlist_id_wishlist_id_fk" FOREIGN KEY ("wishlist_id") REFERENCES "public"."wishlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift" ADD CONSTRAINT "gift_wishlist_id_wishlist_id_fk" FOREIGN KEY ("wishlist_id") REFERENCES "public"."wishlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift" ADD CONSTRAINT "gift_priority_level_id_priority_level_id_fk" FOREIGN KEY ("priority_level_id") REFERENCES "public"."priority_level"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_like" ADD CONSTRAINT "gift_like_gift_id_gift_id_fk" FOREIGN KEY ("gift_id") REFERENCES "public"."gift"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_like" ADD CONSTRAINT "gift_like_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_gift_id_gift_id_fk" FOREIGN KEY ("gift_id") REFERENCES "public"."gift"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderator_assignment" ADD CONSTRAINT "moderator_assignment_wishlist_id_wishlist_id_fk" FOREIGN KEY ("wishlist_id") REFERENCES "public"."wishlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderator_assignment" ADD CONSTRAINT "moderator_assignment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderator_invite" ADD CONSTRAINT "moderator_invite_wishlist_id_wishlist_id_fk" FOREIGN KEY ("wishlist_id") REFERENCES "public"."wishlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderator_invite" ADD CONSTRAINT "moderator_invite_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderator_invite" ADD CONSTRAINT "moderator_invite_used_by_user_id_user_id_fk" FOREIGN KEY ("used_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_follower" ADD CONSTRAINT "wishlist_follower_wishlist_id_wishlist_id_fk" FOREIGN KEY ("wishlist_id") REFERENCES "public"."wishlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_follower" ADD CONSTRAINT "wishlist_follower_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_wishlist_id_wishlist_id_fk" FOREIGN KEY ("wishlist_id") REFERENCES "public"."wishlist"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_gift_id_gift_id_fk" FOREIGN KEY ("gift_id") REFERENCES "public"."gift"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "priority_level_wishlist_order_idx" ON "priority_level" USING btree ("wishlist_id","sort_order");--> statement-breakpoint
CREATE INDEX "wishlist_owner_status_idx" ON "wishlist" USING btree ("owner_id","status") WHERE "wishlist"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "wishlist_short_id_idx" ON "wishlist" USING btree ("short_id");--> statement-breakpoint
CREATE INDEX "gift_wishlist_sort_idx" ON "gift" USING btree ("wishlist_id","sort_order") WHERE "gift"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "gift_like_unique_active" ON "gift_like" USING btree ("gift_id","user_id") WHERE "gift_like"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "gift_like_gift_active_idx" ON "gift_like" USING btree ("gift_id") WHERE "gift_like"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "reservation_gift_active_idx" ON "reservation" USING btree ("gift_id") WHERE "reservation"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "reservation_user_active_idx" ON "reservation" USING btree ("user_id") WHERE "reservation"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "reservation_anon_visitor_active_idx" ON "reservation" USING btree ("anonymous_visitor_id") WHERE "reservation"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "moderator_assignment_unique_active" ON "moderator_assignment" USING btree ("wishlist_id","user_id") WHERE "moderator_assignment"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "moderator_invite_wishlist_idx" ON "moderator_invite" USING btree ("wishlist_id");--> statement-breakpoint
CREATE INDEX "wishlist_follower_user_active_idx" ON "wishlist_follower" USING btree ("user_id") WHERE "wishlist_follower"."unfollowed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "wishlist_follower_user_unfollowed_idx" ON "wishlist_follower" USING btree ("user_id") WHERE "wishlist_follower"."unfollowed_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "notification_user_unread_idx" ON "notification" USING btree ("user_id") WHERE "notification"."read" = false;--> statement-breakpoint
CREATE INDEX "notification_created_at_idx" ON "notification" USING btree ("created_at");