import "server-only";
import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import type { SessionUser } from "@/modules/auth/auth";
import { getGlobalScopes, listRolesWithScopes } from "@/modules/auth/access";
import { isCourseScope, parseScopes, type Scope } from "@/modules/auth/scopes";
import { progressFromCounts, type CourseProgress } from "@/modules/progress/progress";
import { isUuid } from "./access";
import { canTrackProgress, canViewCourse } from "./permissions";

const {
  course,
  courseFile,
  enrollment,
  enrollmentScope,
  lesson,
  lessonProgress,
  role,
  scormPackage,
  user: userTable,
} = schema;

export type CourseListItem = {
  id: string;
  title: string;
  description: string;
  /** Name of the user's course role, or null when they see the course through global scopes only. */
  roleName: string | null;
  tracksProgress: boolean;
  progress: CourseProgress;
};

/**
 * Courses visible to the user: every course when they hold `course:view` globally,
 * otherwise the ones they are enrolled in with a role (or extra scopes) that includes `course:view`.
 */
export async function listCoursesFor(user: SessionUser): Promise<CourseListItem[]> {
  const globalCourseScopes = new Set([...(await getGlobalScopes(user.id))].filter(isCourseScope));
  const [allRows, roles, extras] = await Promise.all([
    db
      .select({
        id: course.id,
        title: course.title,
        description: course.description,
        enrollmentId: enrollment.id,
        roleId: enrollment.roleId,
        roleName: role.name,
      })
      .from(course)
      .leftJoin(enrollment, and(eq(enrollment.courseId, course.id), eq(enrollment.userId, user.id)))
      .leftJoin(role, eq(role.id, enrollment.roleId))
      .orderBy(asc(course.title)),
    listRolesWithScopes("course"),
    db
      .select({ enrollmentId: enrollmentScope.enrollmentId, scope: enrollmentScope.scope })
      .from(enrollmentScope)
      .innerJoin(enrollment, eq(enrollment.id, enrollmentScope.enrollmentId))
      .where(eq(enrollment.userId, user.id)),
  ]);

  const scopesOfRole = new Map(roles.map((entry) => [entry.id, entry.scopes]));
  const rows = allRows
    .map((row) => {
      const scopes = new Set<Scope>(globalCourseScopes);
      for (const scope of (row.roleId && scopesOfRole.get(row.roleId)) || []) scopes.add(scope);
      const own = extras.filter((extra) => extra.enrollmentId === row.enrollmentId).map((extra) => extra.scope);
      for (const scope of parseScopes(own)) if (isCourseScope(scope)) scopes.add(scope);
      return { ...row, access: { scopes } };
    })
    .filter((row) => canViewCourse(row.access));
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
    id: row.id,
    title: row.title,
    description: row.description,
    roleName: row.roleName,
    tracksProgress: canTrackProgress(row.access),
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
      roleId: enrollment.roleId,
      roleName: role.name,
    })
    .from(enrollment)
    .innerJoin(userTable, eq(userTable.id, enrollment.userId))
    .innerJoin(role, eq(role.id, enrollment.roleId))
    .where(eq(enrollment.courseId, courseId))
    .orderBy(asc(role.name), asc(userTable.name));

  const completed = await db
    .select({ userId: lessonProgress.userId, completed: count() })
    .from(lessonProgress)
    .innerJoin(lesson, eq(lesson.id, lessonProgress.lessonId))
    .where(eq(lesson.courseId, courseId))
    .groupBy(lessonProgress.userId);
  const completedByUser = new Map(completed.map((row) => [row.userId, row.completed]));

  const extras = await db
    .select({ enrollmentId: enrollmentScope.enrollmentId, scope: enrollmentScope.scope })
    .from(enrollmentScope)
    .innerJoin(enrollment, eq(enrollment.id, enrollmentScope.enrollmentId))
    .where(eq(enrollment.courseId, courseId));

  return members.map((member) => ({
    ...member,
    completed: completedByUser.get(member.userId) ?? 0,
    /** Scopes assigned to this enrollment on top of the role. */
    extraScopes: parseScopes(extras.filter((extra) => extra.enrollmentId === member.enrollmentId).map((extra) => extra.scope)),
  }));
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
