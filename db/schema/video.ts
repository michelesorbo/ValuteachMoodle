import { jsonb, pgTable, primaryKey, real, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { lesson } from "./courses";

/**
 * What one user has watched of one video lesson.
 * `ranges` is the union of the played time ranges ([start, end] in seconds) across all
 * viewing sessions; the lesson is completed when they cover 90% of `duration`.
 */
export const videoProgress = pgTable(
  "video_progress",
  {
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lesson.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ranges: jsonb("ranges").$type<[number, number][]>().notNull().default([]),
    /** Where to resume playback, in seconds. */
    position: real("position").notNull().default(0),
    /** Video duration in seconds, as first reported by the player. */
    duration: real("duration"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.lessonId, table.userId] })],
);
