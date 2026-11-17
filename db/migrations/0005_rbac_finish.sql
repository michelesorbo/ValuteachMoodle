ALTER TABLE "enrollment" ALTER COLUMN "role_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollment" DROP COLUMN "role";--> statement-breakpoint
DROP TYPE "public"."course_role";