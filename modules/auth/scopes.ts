/**
 * Catalog of scopes: the atomic permissions of the application.
 * Scopes are defined in code (they gate code); which scopes a role or a user
 * holds is data, managed from the UI.
 *
 * - Global scopes apply to the whole platform.
 * - Course scopes apply inside one course. A course role grants them for the
 *   courses the user is enrolled in; when a *global* role or a scope assigned
 *   directly to a user contains them, they apply to every course.
 *
 * Message keys: `scopes.<scope>.name` / `.description` in messages/it.json.
 */
export const GLOBAL_SCOPES = ["users:manage", "roles:manage", "courses:create"] as const;

export const COURSE_SCOPES = [
  "course:view",
  "course:learn",
  "course:manage",
  "course:delete",
  "course:enrollments:manage",
  "course:enrollments:assign-privileged",
] as const;

export type GlobalScope = (typeof GLOBAL_SCOPES)[number];
export type CourseScope = (typeof COURSE_SCOPES)[number];
export type Scope = GlobalScope | CourseScope;

export const ALL_SCOPES: readonly Scope[] = [...GLOBAL_SCOPES, ...COURSE_SCOPES];

/** Scopes that give control over a course or its people. Enrolling someone with them needs `course:enrollments:assign-privileged`. */
export const PRIVILEGED_COURSE_SCOPES: readonly Scope[] = [
  "course:manage",
  "course:delete",
  "course:enrollments:manage",
  "course:enrollments:assign-privileged",
];

/**
 * The system "admin" role holds every scope except `course:learn`, which marks
 * people who take a course (progress is tracked for them), and is computed in code:
 * new scopes reach admins without a data migration and the role cannot be edited into a lockout.
 */
export const ADMIN_SCOPES: readonly Scope[] = ALL_SCOPES.filter((scope) => scope !== "course:learn");

export type RoleKind = "global" | "course";
export const ROLE_KINDS = ["global", "course"] as const satisfies readonly RoleKind[];

export const SYSTEM_ROLES = {
  admin: { kind: "global" },
  teacher: { kind: "course" },
  student: { kind: "course" },
} as const;
export type SystemRoleKey = keyof typeof SYSTEM_ROLES;

const scopeSet: ReadonlySet<string> = new Set(ALL_SCOPES);
const courseScopeSet: ReadonlySet<string> = new Set(COURSE_SCOPES);

export function isScope(value: unknown): value is Scope {
  return typeof value === "string" && scopeSet.has(value);
}

export function isCourseScope(value: unknown): value is CourseScope {
  return typeof value === "string" && courseScopeSet.has(value);
}

/** Drops unknown values (for example scopes removed from the catalog) and duplicates. */
export function parseScopes(values: readonly unknown[]): Scope[] {
  return [...new Set(values.filter(isScope))];
}

/** Scopes a role of this kind may contain: course roles hold course scopes only. */
export function scopesForKind(kind: RoleKind): readonly Scope[] {
  return kind === "global" ? ALL_SCOPES : COURSE_SCOPES;
}

export function scopesAllowedForKind(kind: RoleKind, scopes: readonly Scope[]): boolean {
  return scopes.every((scope) => kind === "global" || isCourseScope(scope));
}

/** Scopes actually granted by a role: the admin role is computed, others are what is stored. */
export function effectiveRoleScopes(role: { systemKey: string | null }, stored: readonly unknown[]): Scope[] {
  return role.systemKey === "admin" ? [...ADMIN_SCOPES] : parseScopes(stored);
}

/** Scopes that only let a person see or take a course: anyone may hand them out. */
const HARMLESS_SCOPES: readonly Scope[] = ["course:view", "course:learn"];

/** Nobody can hand out a power they do not hold themselves (viewing and taking a course are free to give). */
export function canGrant(held: ReadonlySet<string>, scopes: readonly string[]): boolean {
  return scopes.every((scope) => held.has(scope) || (HARMLESS_SCOPES as readonly string[]).includes(scope));
}
