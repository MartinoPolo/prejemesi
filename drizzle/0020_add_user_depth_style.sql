CREATE TYPE "public"."depth_style" AS ENUM('soft', 'ink', 'black');--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "depth_style" "depth_style" DEFAULT 'soft' NOT NULL;
