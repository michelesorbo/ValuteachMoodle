import "server-only";
import { and, asc, count, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import type { SessionUser } from "@/modules/auth/auth";
import { isAdmin } from "@/modules/auth/roles";
import { progressFromCounts, type CourseProgress } from "@/modules/progress/progress";
import { isUuid } from "./access";
import type { CourseRole } from "./permissions";

const { course, courseFile, enrollment, lesson, lessonProgress, scormPackage, user: userTable } = schema;

export type CourseListItem = {
  id: string;
  title: string;
  description: string;
  role: CourseRole | null;
  progress: CourseProgress;
};

/** Courses visible to the user: all of them for an admin, otherwise only the ones they are enrolled in. */
export async function listCoursesFor(user: SessionUser): Promise<CourseListItem[]> {
  const rows = await db
    .select({
      id: course.id,
      title: course.title,
      description: course.description,
      role: enrollment.role,
    })
    .from(course)
    .leftJoin(enrollment, and(eq(enrollment.courseId, course.id), eq(enrollment.userId, user.id)))
    .where(isAdmin(user) ? undefined : isNotNull(enrollment.role))
    .orderBy(asc(course.title));
  if (rows.length === 0) return [];

  const courseIds = rows.map((row) => row.id);
  const totals = await db
    .select({ courseId: lesson.courseId, total: count() })
    .from(lesson)
    .where(inArray(lesson.courseId, courseIds))
    .groupBy(lesson.courseId);
  const completed = await db
    .select({ courseId: lesson.courseId, completed: count() })
    .from(lessonProgress)
    .innerJoin(lesson, eq(lesson.id, lessonProgress.lessonId))
    .where(and(eq(lessonProgress.userId, user.id), inArray(lesson.courseId, courseIds)))
    .groupBy(lesson.courseId);

  const totalByCourse = new Map(totals.map((row) => [row.courseId, row.total]));
  const completedByCourse = new Map(completed.map((row) => [row.courseId, row.completed]));

  return rows.map((row) => ({
    ...row,
    progress: progressFromCounts(completedByCourse.get(row.id) ?? 0, totalByCourse.get(row.id) ?? 0),
  }));
}

export async function listLessons(courseId: string) {
  return db
    .select({ id: lesson.id, title: lesson.title, type: lesson.type, position: lesson.position })
    .from(lesson)
    .where(eq(lesson.courseId, courseId))
    .orderBy(asc(lesson.position), asc(lesson.createdAt));
}

export async function listCompletedLessonIds(courseId: string, userId: string): Promise<string[]> {
  const rows = await db
    .select({ lessonId: lessonProgress.lessonId })
    .from(lessonProgress)
    .innerJoin(lesson, eq(lesson.id, lessonProgress.lessonId))
    .where(and(eq(lesson.courseId, courseId), eq(lessonProgress.userId, userId)));
  return rows.map((row) => row.lessonId);
}

/** A lesson with its attached file or SCORM package (if any). Returns null for malformed or unknown ids. */
export async function getLesson(lessonId: string) {
  if (!isUuid(lessonId)) return null;
  const [row] = await db
    .select({ lesson, file: courseFile, scorm: scormPackage })
    .from(lesson)
    .leftJoin(courseFile, eq(courseFile.id, lesson.fileId))
    .leftJoin(scormPackage, eq(scormPackage.id, lesson.scormPackageId))
    .where(eq(lesson.id, lessonId));
  return row ?? null;
}

export async function isLessonCompleted(lessonId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ lessonId: lessonProgress.lessonId })
    .from(lessonProgress)
    .where(and(eq(lessonProgress.lessonId, lessonId), eq(lessonProgress.userId, userId)));
  return row !== undefined;
}

/** Enrolled users with, for each of them, the number of completed lessons of the course. */
export async function listMembers(courseId: string) {
  const members = await db
    .select({
      enrollmentId: enrollment.id,
      userId: userTable.id,
      name: userTable.name,
      email: userTable.email,
      role: enrollment.role,
    })
    .from(enrollment)
    .innerJoin(userTable, eq(userTable.id, enrollment.userId))
    .where(eq(enrollment.courseId, courseId))
    .orderBy(asc(enrollment.role), asc(userTable.name));

  const completed = await db
    .select({ userId: lessonProgress.userId, completed: count() })
    .from(lessonProgress)
    .innerJoin(lesson, eq(lesson.id, lessonProgress.lessonId))
    .where(eq(lesson.courseId, courseId))
    .groupBy(lessonProgress.userId);
  const completedByUser = new Map(completed.map((row) => [row.userId, row.completed]));

  return members.map((member) => ({ ...member, completed: completedByUser.get(member.userId) ?? 0 }));
}

/** Users that are not enrolled in the course yet. */
export async function listEnrollableUsers(courseId: string) {
  return db
    .select({ id: userTable.id, name: userTable.name, email: userTable.email })
    .from(userTable)
    .leftJoin(enrollment, and(eq(enrollment.userId, userTable.id), eq(enrollment.courseId, courseId)))
    .where(isNull(enrollment.id))
    .orderBy(asc(userTable.name));
}
