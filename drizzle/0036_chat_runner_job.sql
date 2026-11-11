CREATE TABLE "chat_runner_job" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"status" text NOT NULL,
	"model" text NOT NULL,
	"system_prompt" text NOT NULL,
	"prompt" text NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"token_hash" text,
	"report_sequence" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "chat_runner_job" ADD CONSTRAINT "chat_runner_job_session_id_chat_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_runner_job_status_created_idx" ON "chat_runner_job" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "chat_runner_job_session_status_idx" ON "chat_runner_job" USING btree ("session_id","status");