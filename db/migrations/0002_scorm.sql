CREATE TABLE "scorm_package" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"extracted_key" text NOT NULL,
	"storage_key" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"launch_path" text NOT NULL,
	"launch_query" text DEFAULT '' NOT NULL,
	"mastery_score" real,
	"original_name" text NOT NULL,
	"size" bigint NOT NULL,
	"uploaded_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scorm_package_extracted_key_unique" UNIQUE("extracted_key")
);
--> statement-breakpoint
CREATE TABLE "scorm_attempt" (
	"lesson_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"lesson_status" text DEFAULT 'not attempted' NOT NULL,
	"score_raw" real,
	"score_min" real,
	"score_max" real,
	"total_seconds" integer DEFAULT 0 NOT NULL,
	"last_session_id" text,
	"last_session_seconds" integer DEFAULT 0 NOT NULL,
	"cmi" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scorm_attempt_lesson_id_user_id_pk" PRIMARY KEY("lesson_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "lesson" ADD COLUMN "scorm_package_id" uuid;--> statement-breakpoint
ALTER TABLE "scorm_package" ADD CONSTRAINT "scorm_package_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorm_package" ADD CONSTRAINT "scorm_package_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorm_attempt" ADD CONSTRAINT "scorm_attempt_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorm_attempt" ADD CONSTRAINT "scorm_attempt_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scorm_package_course_idx" ON "scorm_package" USING btree ("course_id");--> statement-breakpoint
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_scorm_package_id_scorm_package_id_fk" FOREIGN KEY ("scorm_package_id") REFERENCES "public"."scorm_package"("id") ON DELETE cascade ON UPDATE no action;