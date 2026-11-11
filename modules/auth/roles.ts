/**
 * Global roles. "admin" is the only global privilege; student/teacher are
 * per-course roles stored on the enrollment (see modules/courses, phase 2).
 */
export const GLOBAL_ROLES = ["user", "admin"] as const;
export type GlobalRole = (typeof GLOBAL_ROLES)[number];

export const MIN_PASSWORD_LENGTH = 10;

/** Better Auth stores roles as a comma-separated string. */
export function isAdmin(user: { role?: string | null } | null | undefined): boolean {
  if (!user?.role) return false;
  return user.role
    .split(",")
    .map((role) => role.trim())
    .includes("admin");
}
