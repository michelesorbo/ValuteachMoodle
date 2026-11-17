/**
 * Course permission rules (pure functions, no I/O), expressed on scopes.
 *
 * `CourseAccess.scopes` are the scopes the user holds in one course: those of their
 * course role, those assigned to their enrollment, and the course-level scopes of
 * their global roles (which apply to every course). Loaded by getCourseScopes().
 */
import { canGrant, PRIVILEGED_COURSE_SCOPES, type Scope } from "@/modules/auth/scopes";

export type CourseAccess = {
  scopes: ReadonlySet<Scope>;
};

const has = (access: CourseAccess, scope: Scope) => access.scopes.has(scope);

export function canCreateCourse(globalScopes: ReadonlySet<Scope>): boolean {
  return globalScopes.has("courses:create");
}

export function canViewCourse(access: CourseAccess): boolean {
  return has(access, "course:view");
}

/** Lessons and uploads. */
export function canManageCourse(access: CourseAccess): boolean {
  return has(access, "course:manage");
}

export function canDeleteCourse(access: CourseAccess): boolean {
  return has(access, "course:delete");
}

/** Progress is tracked for people who take the course. */
export function canTrackProgress(access: CourseAccess): boolean {
  return has(access, "course:learn");
}

/**
 * Enrolling someone with scopes `granted` (the scopes of the chosen role, plus extras),
 * or removing such an enrollment. Needs `course:enrollments:manage`, cannot hand out
 * scopes the actor does not hold, and handing out management scopes also needs
 * `course:enrollments:assign-privileged` (so a teacher enrolls students, not other teachers).
 */
export function canManageEnrollment(access: CourseAccess, granted: readonly Scope[]): boolean {
  if (!has(access, "course:enrollments:manage")) return false;
  if (!canGrant(access.scopes, granted)) return false;
  const privileged = granted.some((scope) => PRIVILEGED_COURSE_SCOPES.includes(scope));
  return !privileged || has(access, "course:enrollments:assign-privileged");
}
