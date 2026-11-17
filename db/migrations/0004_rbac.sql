CREATE TYPE "public"."role_kind" AS ENUM('global', 'course');--> statement-breakpoint
CREATE TABLE "role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"system_key" text,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"kind" "role_kind" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "role_system_key_unique" UNIQUE("system_key"),
	CONSTRAINT "role_kind_name_unique" UNIQUE("kind","name")
);
--> statement-breakpoint
CREATE TABLE "role_scope" (
	"role_id" uuid NOT NULL,
	"scope" text NOT NULL,
	CONSTRAINT "role_scope_role_id_scope_pk" PRIMARY KEY("role_id","scope")
);
--> statement-breakpoint
CREATE TABLE "user_role" (
	"user_id" text NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "user_role_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "user_scope" (
	"user_id" text NOT NULL,
	"scope" text NOT NULL,
	CONSTRAINT "user_scope_user_id_scope_pk" PRIMARY KEY("user_id","scope")
);
--> statement-breakpoint
CREATE TABLE "enrollment_scope" (
	"enrollment_id" uuid NOT NULL,
	"scope" text NOT NULL,
	CONSTRAINT "enrollment_scope_enrollment_id_scope_pk" PRIMARY KEY("enrollment_id","scope")
);
--> statement-breakpoint
ALTER TABLE "enrollment" ADD COLUMN "role_id" uuid;--> statement-breakpoint
ALTER TABLE "role_scope" ADD CONSTRAINT "role_scope_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_scope" ADD CONSTRAINT "user_scope_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_scope" ADD CONSTRAINT "enrollment_scope_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_role_role_idx" ON "user_role" USING btree ("role_id");--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
-- Built-in roles. The scopes of "admin" are computed in code (modules/auth/scopes.ts).
INSERT INTO "role" ("system_key", "name", "description", "kind") VALUES
	('admin', 'Amministratore', 'Gestisce utenti, ruoli e tutti i corsi.', 'global'),
	('teacher', 'Docente', 'Gestisce lezioni e iscrizioni degli studenti del corso.', 'course'),
	('student', 'Studente', 'Segue il corso e registra i propri progressi.', 'course');--> statement-breakpoint
INSERT INTO "role_scope" ("role_id", "scope")
SELECT r."id", s.scope FROM "role" r, (VALUES
	('teacher', 'course:view'),
	('teacher', 'course:manage'),
	('teacher', 'course:enrollments:manage'),
	('student', 'course:view'),
	('student', 'course:learn')
) AS s(key, scope) WHERE r."system_key" = s.key;--> statement-breakpoint
UPDATE "enrollment" SET "role_id" = (SELECT "id" FROM "role" WHERE "system_key" = "enrollment"."role"::text);--> statement-breakpoint
INSERT INTO "user_role" ("user_id", "role_id")
SELECT u."id", (SELECT "id" FROM "role" WHERE "system_key" = 'admin') FROM "user" u
WHERE 'admin' = ANY(string_to_array(replace(u."role", ' ', ''), ','));--> statement-breakpoint
-- Better Auth's own "role" column is no longer used for authorization.
UPDATE "user" SET "role" = 'user' WHERE "role" IS DISTINCT FROM 'user';
