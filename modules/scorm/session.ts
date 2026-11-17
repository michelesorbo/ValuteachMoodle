import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Lesson, ScormPackage } from "@/db/schema";
import { getCourseScopes } from "@/modules/auth/access";
import { env } from "@/modules/config/env";
import { canTrackProgress, canViewCourse, type CourseAccess } from "@/modules/courses/permissions";
import { scormOrigin } from "./origin";
import {
  SCORM_TOKEN_TTL_SECONDS,
  signScormToken,
  verifyScormToken,
  type ScormTokenPayload,
} from "./token";
import { applyCommit, emptyAttempt, type AttemptState, type CommitInput } from "./tracking";

const { lesson, lessonProgress, scormAttempt, scormPackage, user } = schema;

/**
 * URL of the player on the SCORM origin for one user and one SCORM lesson.
 * Call it only after checking that the user may view the course.
 */
export function createScormLaunchUrl(userId: string, lessonId: string, pkg: ScormPackage): string {
  const token = signScormToken(
    {
      userId,
      lessonId,
      packageKey: pkg.storageKey,
      sessionId: randomUUID(),
      exp: Math.floor(Date.now() / 1000) + SCORM_TOKEN_TTL_SECONDS,
    },
    env().BETTER_AUTH_SECRET,
  );
  return `${scormOrigin()}/scorm/${token}/player`;
}

export function readScormToken(token: string): ScormTokenPayload | null {
  return verifyScormToken(token, env().BETTER_AUTH_SECRET);
}

export type ScormSession = {
  payload: ScormTokenPayload;
  user: { id: string; name: string };
  lesson: Lesson;
  pkg: ScormPackage;
  access: CourseAccess;
};

/**
 * Resolves a token to a live session. Besides the signature and expiry, it re-checks
 * in the database that the lesson still uses that package and that the user may still
 * view the course: removing an enrollment takes effect at once
 * for the player and for tracking.
 */
export async function loadScormSession(token: string): Promise<ScormSession | null> {
  const payload = readScormToken(token);
  if (!payload) return null;

  const [row] = await db
    .select({ lesson, pkg: scormPackage })
    .from(lesson)
    .innerJoin(scormPackage, eq(scormPackage.id, lesson.scormPackageId))
    .where(eq(lesson.id, payload.lessonId));
  if (!row || row.pkg.storageKey !== payload.packageKey) return null;

  const [account] = await db
    .select({ id: user.id, name: user.name, banned: user.banned })
    .from(user)
    .where(eq(user.id, payload.userId));
  if (!account || account.banned) return null;

  const access: CourseAccess = { scopes: await getCourseScopes(account.id, row.lesson.courseId) };
  if (!canViewCourse(access)) return null;

  return { payload, user: { id: account.id, name: account.name }, lesson: row.lesson, pkg: row.pkg, access };
}

function toState(row: typeof scormAttempt.$inferSelect): AttemptState {
  return {
    lessonStatus: row.lessonStatus,
    scoreRaw: row.scoreRaw,
    scoreMin: row.scoreMin,
    scoreMax: row.scoreMax,
    totalSeconds: row.totalSeconds,
    lastSessionId: row.lastSessionId,
    lastSessionSeconds: row.lastSessionSeconds,
    cmi: row.cmi,
  };
}

/** Saved attempt of the session's user, or an empty one. Teachers and admins only preview. */
export async function loadAttempt(session: ScormSession): Promise<AttemptState> {
  if (!canTrackProgress(session.access)) return emptyAttempt;
  const [row] = await db
    .select()
    .from(scormAttempt)
    .where(and(eq(scormAttempt.lessonId, session.lesson.id), eq(scormAttempt.userId, session.user.id)));
  return row ? toState(row) : emptyAttempt;
}

/**
 * Persists a commit from the player. Returns whether the lesson is now completed.
 * Only students have tracking: for teachers and admins the commit is accepted and ignored.
 */
export async function saveCommit(session: ScormSession, commit: CommitInput): Promise<{ completed: boolean }> {
  if (!canTrackProgress(session.access)) return { completed: false };
  const key = { lessonId: session.lesson.id, userId: session.user.id };

  return db.transaction(async (tx) => {
    // Make sure the row exists, then lock it: commits of the same attempt are applied one at a time.
    await tx.insert(scormAttempt).values(key).onConflictDoNothing();
    const [current] = await tx
      .select()
      .from(scormAttempt)
      .where(and(eq(scormAttempt.lessonId, key.lessonId), eq(scormAttempt.userId, key.userId)))
      .for("update");

    const { attempt, completed } = applyCommit(toState(current), commit, session.payload.sessionId);
    await tx
      .update(scormAttempt)
      .set(attempt)
      .where(and(eq(scormAttempt.lessonId, key.lessonId), eq(scormAttempt.userId, key.userId)));

    if (completed) {
      // Completion is permanent: a later "failed" or "incomplete" does not undo it.
      await tx.insert(lessonProgress).values(key).onConflictDoNothing();
    }
    return { completed };
  });
}
