CREATE TYPE "public"."preferred_locale" AS ENUM('cs', 'en');--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "preferred_locale" "preferred_locale";