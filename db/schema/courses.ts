import {
  bigint,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { role } from "./rbac";

/** "video" and "scorm" are implemented in later phases; declared now to avoid an enum migration. */
export const lessonType = pgEnum("lesson_type", ["text", "file", "video", "scorm"]);

export const course = pgTable("course", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const enrollment = pgTable(
  "enrollment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => course.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Course role (kind "course"). Its scopes apply inside this course. */
    roleId: uuid("role_id")
      .notNull()
      .references(() => role.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("enrollment_course_user_unique").on(table.courseId, table.userId),
    index("enrollment_user_idx").on(table.userId),
  ],
);

/** Scopes assigned to one user inside one course, on top of the scopes of their course role. */
export const enrollmentScope = pgTable(
  "enrollment_scope",
  {
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollment.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
  },
  (table) => [primaryKey({ columns: [table.enrollmentId, table.scope] })],
);

/** A file stored under FILES_DIR. `storageKey` is a server-generated relative path, never user input. */
export const courseFile = pgTable(
  "course_file",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => course.id, { onDelete: "cascade" }),
    /** "file": offered as a download. "video": an MP4 streamed in the lesson player. */
    kind: text("kind", { enum: ["file", "video"] }).notNull().default("file"),
    storageKey: text("storage_key").notNull().unique(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    uploadedBy: text("uploaded_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("course_file_course_idx").on(table.courseId)],
);

/** An extracted SCORM 1.2 package. `storageKey` is the directory that contains imsmanifest.xml. */
export const scormPackage = pgTable(
  "scorm_package",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => course.id, { onDelete: "cascade" }),
    /** Directory removed when the package is deleted (may be a parent of `storageKey`). */
    extractedKey: text("extracted_key").notNull().unique(),
    storageKey: text("storage_key").notNull(),
    title: text("title").notNull().default(""),
    /** Launch file relative to `storageKey`, plus the optional query string from the manifest. */
    launchPath: text("launch_path").notNull(),
    launchQuery: text("launch_query").notNull().default(""),
    masteryScore: real("mastery_score"),
    originalName: text("original_name").notNull(),
    /** Size of the uploaded zip, in bytes. */
    size: bigint("size", { mode: "number" }).notNull(),
    uploadedBy: text("uploaded_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("scorm_package_course_idx").on(table.courseId)],
);

export const lesson = pgTable(
  "lesson",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => course.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    type: lessonType("type").notNull(),
    position: integer("position").notNull(),
    /** Body of a text lesson (plain text). */
    content: text("content").notNull().default(""),
    /** Attached file of a file lesson. Deleting the file deletes the lesson. */
    fileId: uuid("file_id").references(() => courseFile.id, { onDelete: "cascade" }),
    /** Package of a SCORM lesson. Deleting the package deletes the lesson. */
    scormPackageId: uuid("scorm_package_id").references(() => scormPackage.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("lesson_course_position_idx").on(table.courseId, table.position)],
);

/** One row per lesson a user has completed. Course completion is derived from these rows. */
export const lessonProgress = pgTable(
  "lesson_progress",
  {
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lesson.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.lessonId, table.userId] }),
    index("lesson_progress_user_idx").on(table.userId),
  ],
);

export type Course = typeof course.$inferSelect;
export type Lesson = typeof lesson.$inferSelect;
export type CourseFile = typeof courseFile.$inferSelect;
export type ScormPackage = typeof scormPackage.$inferSelect;
export type LessonType = (typeof lessonType.enumValues)[number];
