import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { isVideoCompleted, mergeRanges, watchedPercent, type TimeRange } from "./video";

const { lessonProgress, videoProgress } = schema;

const seconds = z.number().finite().min(0).max(1_000_000);

/** What the player reports: the ranges played in this session, where it is now, and the video length. */
export const videoReportSchema = z.object({
  ranges: z.array(z.tuple([seconds, seconds])).max(500),
  position: seconds,
  duration: seconds.positive(),
});

export type VideoReport = z.infer<typeof videoReportSchema>;

export type VideoProgressSummary = {
  percent: number;
  /** Where to resume playback, in seconds. */
  position: number;
  completed: boolean;
};

export async function loadVideoProgress(lessonId: string, userId: string): Promise<VideoProgressSummary> {
  const [row] = await db
    .select()
    .from(videoProgress)
    .where(and(eq(videoProgress.lessonId, lessonId), eq(videoProgress.userId, userId)));
  if (!row || !row.duration) return { percent: 0, position: 0, completed: false };
  return {
    percent: watchedPercent(row.ranges, row.duration),
    position: row.position,
    completed: isVideoCompleted(row.ranges, row.duration),
  };
}

/**
 * Merges a report into the stored progress and completes the lesson at 90% watched.
 * The duration is fixed by the first report, so later reports cannot shrink the video.
 */
export async function saveVideoProgress(
  lessonId: string,
  userId: string,
  report: VideoReport,
): Promise<VideoProgressSummary> {
  const key = and(eq(videoProgress.lessonId, lessonId), eq(videoProgress.userId, userId));

  return db.transaction(async (tx) => {
    // Make sure the row exists, then lock it: reports of the same viewer are applied one at a time.
    await tx.insert(videoProgress).values({ lessonId, userId }).onConflictDoNothing();
    const [current] = await tx.select().from(videoProgress).where(key).for("update");

    const duration = current.duration ?? report.duration;
    const ranges = mergeRanges(current.ranges, report.ranges as TimeRange[], duration);
    const position = Math.min(report.position, duration);
    await tx.update(videoProgress).set({ ranges, position, duration }).where(key);

    const completed = isVideoCompleted(ranges, duration);
    if (completed) {
      await tx.insert(lessonProgress).values({ lessonId, userId }).onConflictDoNothing();
    }
    return { percent: watchedPercent(ranges, duration), position, completed };
  });
}
