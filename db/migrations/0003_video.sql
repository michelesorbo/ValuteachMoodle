CREATE TABLE "video_progress" (
	"lesson_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"ranges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"position" real DEFAULT 0 NOT NULL,
	"duration" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "video_progress_lesson_id_user_id_pk" PRIMARY KEY("lesson_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "course_file" ADD COLUMN "kind" text DEFAULT 'file' NOT NULL;--> statement-breakpoint
ALTER TABLE "video_progress" ADD CONSTRAINT "video_progress_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_progress" ADD CONSTRAINT "video_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;