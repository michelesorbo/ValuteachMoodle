import { z } from "zod";
import { isCompletedStatus, LESSON_STATUSES, MAX_ELEMENT_LENGTH, type CmiData } from "./api";

/**
 * Server side of a commit: turns what the player sent into the stored attempt (pure, no I/O).
 * The player is untrusted input, so everything is validated and bounded here.
 */
const MAX_ELEMENTS = 5_000;

export const commitSchema = z.object({
  cmi: z
    .record(z.string().max(200).regex(/^cmi\./), z.string().max(MAX_ELEMENT_LENGTH))
    .refine((cmi) => Object.keys(cmi).length <= MAX_ELEMENTS),
  sessionSeconds: z
    .number()
    .min(0)
    .max(9999 * 3600),
  finished: z.boolean(),
});

export type CommitInput = z.infer<typeof commitSchema>;

/** What is persisted for one user and one SCORM lesson. */
export type AttemptState = {
  lessonStatus: string;
  scoreRaw: number | null;
  scoreMin: number | null;
  scoreMax: number | null;
  /** Time of all the sessions before `lastSessionId`. */
  totalSeconds: number;
  lastSessionId: string | null;
  lastSessionSeconds: number;
  cmi: CmiData;
};

export const emptyAttempt: AttemptState = {
  lessonStatus: "not attempted",
  scoreRaw: null,
  scoreMin: null,
  scoreMax: null,
  totalSeconds: 0,
  lastSessionId: null,
  lastSessionSeconds: 0,
  cmi: {},
};

function score(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null;
}

/** Time to report to the content as cmi.core.total_time at the start of a new session. */
export function totalSecondsOf(attempt: AttemptState): number {
  return attempt.totalSeconds + attempt.lastSessionSeconds;
}

/**
 * Applies a commit to the stored attempt.
 * Time is idempotent per session: repeated commits of the same session replace its
 * duration, and only a new session id folds the previous one into the total.
 */
export function applyCommit(
  previous: AttemptState,
  commit: CommitInput,
  sessionId: string,
): { attempt: AttemptState; completed: boolean } {
  const sameSession = previous.lastSessionId === sessionId;
  const sessionSeconds = Math.round(commit.sessionSeconds);

  const reported = commit.cmi["cmi.core.lesson_status"];
  const lessonStatus = (LESSON_STATUSES as readonly string[]).includes(reported)
    ? reported
    : previous.lessonStatus;

  const attempt: AttemptState = {
    lessonStatus,
    scoreRaw: score(commit.cmi["cmi.core.score.raw"]),
    scoreMin: score(commit.cmi["cmi.core.score.min"]),
    scoreMax: score(commit.cmi["cmi.core.score.max"]),
    totalSeconds: sameSession ? previous.totalSeconds : totalSecondsOf(previous),
    lastSessionId: sessionId,
    // Within a session the duration never goes backwards.
    lastSessionSeconds: sameSession ? Math.max(previous.lastSessionSeconds, sessionSeconds) : sessionSeconds,
    cmi: commit.cmi,
  };
  return { attempt, completed: isCompletedStatus(lessonStatus) };
}
