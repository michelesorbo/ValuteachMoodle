import { integer, jsonb, pgTable, primaryKey, real, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { lesson } from "./courses";

/**
 * SCORM 1.2 tracking for one user on one SCORM lesson (a single, resumable attempt).
 * Status, score and time are denormalized for reporting; `cmi` holds every element
 * the content saved, so a later session can resume exactly where it stopped.
 */
export const scormAttempt = pgTable(
  "scorm_attempt",
  {
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lesson.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lessonStatus: text("lesson_status").notNull().default("not attempted"),
    scoreRaw: real("score_raw"),
    scoreMin: real("score_min"),
    scoreMax: real("score_max"),
    /** Seconds spent in the sessions before `lastSessionId`. */
    totalSeconds: integer("total_seconds").notNull().default(0),
    lastSessionId: text("last_session_id"),
    lastSessionSeconds: integer("last_session_seconds").notNull().default(0),
    cmi: jsonb("cmi").$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.lessonId, table.userId] })],
);
