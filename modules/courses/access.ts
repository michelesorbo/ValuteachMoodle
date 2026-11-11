import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import type { Course } from "@/db/schema";
import type { SessionUser } from "@/modules/auth/auth";
import { isAdmin } from "@/modules/auth/roles";
import { getCurrentUser } from "@/modules/auth/session";
import { canManageCourse, canViewCourse, type CourseAccess } from "./permissions";

const uuidSchema = z.uuid();

/** Route params are untrusted: check them before they reach a uuid column. */
export function isUuid(value: unknown): value is string {
  return uuidSchema.safeParse(value).success;
}

export type CourseContext = {
  user: SessionUser;
  course: Course;
  access: CourseAccess;
};

/**
 * Loads a course together with the current user's access to it.
 * Returns null when there is no session, the id is malformed or the course does not exist.
 * Callers must still check the access with a function from ./permissions.
 */
export async function getCourseContext(courseId: string): Promise<CourseContext | null> {
  const user = await getCurrentUser();
  if (!user || !isUuid(courseId)) return null;

  const [row] = await db
    .select({ course: schema.course, role: schema.enrollment.role })
    .from(schema.course)
    .leftJoin(
      schema.enrollment,
      and(eq(schema.enrollment.courseId, schema.course.id), eq(schema.enrollment.userId, user.id)),
    )
    .where(eq(schema.course.id, courseId));
  if (!row) return null;

  return { user, course: row.course, access: { isAdmin: isAdmin(user), role: row.role } };
}

/** Course context only if the current user may see the course (enrolled or admin). */
export async function getViewableCourse(courseId: string): Promise<CourseContext | null> {
  const context = await getCourseContext(courseId);
  return context && canViewCourse(context.access) ? context : null;
}

/** Course context only if the current user may manage the course (teacher of it or admin). */
export async function getManageableCourse(courseId: string): Promise<CourseContext | null> {
  const context = await getCourseContext(courseId);
  return context && canManageCourse(context.access) ? context : null;
}
