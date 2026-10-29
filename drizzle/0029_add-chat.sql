CREATE TABLE "chat_message" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"sequence" integer GENERATED ALWAYS AS IDENTITY (sequence name "chat_message_sequence_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"role" text NOT NULL,
	"content" jsonb NOT NULL,
	"proposal_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"wishlist_id" text NOT NULL,
	"title" text NOT NULL,
	"fast_forward" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_turn_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_session_id_chat_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_proposal_id_change_proposal_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."change_proposal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_session" ADD CONSTRAINT "chat_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_session" ADD CONSTRAINT "chat_session_wishlist_id_wishlist_id_fk" FOREIGN KEY ("wishlist_id") REFERENCES "public"."wishlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_message_session_sequence_idx" ON "chat_message" USING btree ("session_id","sequence");--> statement-breakpoint
CREATE INDEX "chat_message_role_created_idx" ON "chat_message" USING btree ("role","created_at");--> statement-breakpoint
CREATE INDEX "chat_session_user_wishlist_idx" ON "chat_session" USING btree ("user_id","wishlist_id","last_turn_at");--> statement-breakpoint
CREATE INDEX "chat_session_last_turn_idx" ON "chat_session" USING btree ("last_turn_at");