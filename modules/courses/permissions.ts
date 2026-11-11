/**
 * Course permission rules (pure functions, no I/O).
 *
 * - admin (global): everything, on every course.
 * - teacher (per course): manages lessons and enrolled students of that course.
 * - student (per course): views the course and tracks their own progress.
 * Only admins create/delete courses and assign or remove teachers.
 */
export type CourseRole = "student" | "teacher";

export type CourseAccess = {
  isAdmin: boolean;
  /** Role from the user's enrollment in this course, or null when not enrolled. */
  role: CourseRole | null;
};

export const COURSE_ROLES = ["student", "teacher"] as const satisfies readonly CourseRole[];

export function canCreateCourse(user: { isAdmin: boolean }): boolean {
  return user.isAdmin;
}

export function canViewCourse(access: CourseAccess): boolean {
  return access.isAdmin || access.role !== null;
}

/** Lessons, uploads and student enrollments. */
export function canManageCourse(access: CourseAccess): boolean {
  return access.isAdmin || access.role === "teacher";
}

export function canDeleteCourse(access: CourseAccess): boolean {
  return access.isAdmin;
}

/** Enrolling someone with `targetRole`, or removing an enrollment that has `targetRole`. */
export function canManageEnrollment(access: CourseAccess, targetRole: CourseRole): boolean {
  if (access.isAdmin) return true;
  return access.role === "teacher" && targetRole === "student";
}

/** Progress is tracked only for students of the course. */
export function canTrackProgress(access: CourseAccess): boolean {
  return access.role === "student";
}
