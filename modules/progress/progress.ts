/**
 * Completion rules (pure functions, no I/O).
 * - text and file lessons: completed with the "mark as completed" button;
 * - video (90% watched) and SCORM (`completed`/`passed`) arrive in later phases;
 * - a course is completed when all of its lessons are (and it has at least one).
 */
export const MANUAL_COMPLETION_TYPES = ["text", "file"] as const;

export function isManuallyCompletable(type: string): boolean {
  return (MANUAL_COMPLETION_TYPES as readonly string[]).includes(type);
}

export type CourseProgress = {
  completed: number;
  total: number;
  /** 0–100, rounded down so that 100 always means "all lessons completed". */
  percent: number;
  isCompleted: boolean;
};

export function progressFromCounts(completed: number, total: number): CourseProgress {
  const safeTotal = Math.max(0, total);
  const safeCompleted = Math.min(Math.max(0, completed), safeTotal);
  return {
    completed: safeCompleted,
    total: safeTotal,
    percent: safeTotal === 0 ? 0 : Math.floor((safeCompleted / safeTotal) * 100),
    isCompleted: safeTotal > 0 && safeCompleted === safeTotal,
  };
}

/** Counts only completions that belong to the course's current lessons. */
export function computeCourseProgress(
  lessonIds: readonly string[],
  completedLessonIds: Iterable<string>,
): CourseProgress {
  const completed = new Set(completedLessonIds);
  return progressFromCounts(lessonIds.filter((id) => completed.has(id)).length, lessonIds.length);
}
