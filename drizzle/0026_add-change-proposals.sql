CREATE TABLE "agent_idempotency_key" (
	"token_id" text NOT NULL,
	"key" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_idempotency_key_token_id_key_pk" PRIMARY KEY("token_id","key")
);
--> statement-breakpoint
CREATE TABLE "change_proposal" (
	"id" text PRIMARY KEY NOT NULL,
	"wishlist_id" text,
	"submitter_user_id" text NOT NULL,
	"token_id" text,
	"channel" text NOT NULL,
	"token_name" text NOT NULL,
	"grant" jsonb NOT NULL,
	"status" text NOT NULL,
	"rows" jsonb NOT NULL,
	"row_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"applied_at" timestamp with time zone,
	"applied_batch_id" text,
	"applied_row_ids" text[],
	"undo_targets" jsonb,
	"discarded_at" timestamp with time zone,
	"undone_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "agent_idempotency_key" ADD CONSTRAINT "agent_idempotency_key_token_id_personal_access_token_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."personal_access_token"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_proposal" ADD CONSTRAINT "change_proposal_wishlist_id_wishlist_id_fk" FOREIGN KEY ("wishlist_id") REFERENCES "public"."wishlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_proposal" ADD CONSTRAINT "change_proposal_submitter_user_id_user_id_fk" FOREIGN KEY ("submitter_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_proposal" ADD CONSTRAINT "change_proposal_token_id_personal_access_token_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."personal_access_token"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_idempotency_key_created_idx" ON "agent_idempotency_key" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "change_proposal_submitter_created_idx" ON "change_proposal" USING btree ("submitter_user_id","created_at");--> statement-breakpoint
CREATE INDEX "change_proposal_expires_idx" ON "change_proposal" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "change_proposal_wishlist_idx" ON "change_proposal" USING btree ("wishlist_id");--> statement-breakpoint
CREATE INDEX "change_proposal_token_idx" ON "change_proposal" USING btree ("token_id");