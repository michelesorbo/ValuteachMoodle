import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import type { Course } from "@/db/schema";
import type { SessionUser } from "@/modules/auth/auth";
import { getCourseScopes } from "@/modules/auth/access";
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

  const [course] = await db.select().from(schema.course).where(eq(schema.course.id, courseId));
  if (!course) return null;

  return { user, course, access: { scopes: await getCourseScopes(user.id, course.id) } };
}

/** Course context only if the current user may see the course (course:view). */
export async function getViewableCourse(courseId: string): Promise<CourseContext | null> {
  const context = await getCourseContext(courseId);
  return context && canViewCourse(context.access) ? context : null;
}

/** Course context only if the current user may manage the course (course:manage). */
export async function getManageableCourse(courseId: string): Promise<CourseContext | null> {
  const context = await getCourseContext(courseId);
  return context && canManageCourse(context.access) ? context : null;
}
