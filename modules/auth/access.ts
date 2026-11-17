import "server-only";
import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { effectiveRoleScopes, isCourseScope, parseScopes, type RoleKind, type Scope } from "./scopes";

const { enrollment, enrollmentScope, role, roleScope, userRole, userScope } = schema;

/** Every role with its effective scopes (computed for "admin", stored for the others), optionally one kind only. */
export async function listRolesWithScopes(kind?: RoleKind) {
  const [roles, stored] = await Promise.all([
    db.select().from(role).orderBy(role.name),
    db.select().from(roleScope),
  ]);
  return roles
    .filter((row) => kind === undefined || row.kind === kind)
    .map((row) => ({
      ...row,
      scopes: effectiveRoleScopes(
        row,
        stored.filter((entry) => entry.roleId === row.id).map((entry) => entry.scope),
      ),
    }));
}

export type RoleWithScopes = Awaited<ReturnType<typeof listRolesWithScopes>>[number];

/** Effective scopes of the given roles, by role id. */
export async function scopesOfRoles(roleIds: readonly string[]): Promise<Map<string, Scope[]>> {
  const wanted = new Set(roleIds);
  if (wanted.size === 0) return new Map();
  const roles = await listRolesWithScopes();
  return new Map(roles.filter((row) => wanted.has(row.id)).map((row) => [row.id, row.scopes]));
}

/**
 * Global scopes of a user: from their global roles plus the scopes assigned to them directly.
 * Includes course scopes, which then apply to every course.
 */
export const getGlobalScopes = cache(async (userId: string): Promise<ReadonlySet<Scope>> => {
  const [roles, direct] = await Promise.all([
    db.select({ roleId: userRole.roleId }).from(userRole).where(eq(userRole.userId, userId)),
    db.select({ scope: userScope.scope }).from(userScope).where(eq(userScope.userId, userId)),
  ]);
  const byRole = await scopesOfRoles(roles.map((row) => row.roleId));
  return new Set([...[...byRole.values()].flat(), ...parseScopes(direct.map((row) => row.scope))]);
});

/**
 * Scopes of a user inside one course: the course-level part of their global scopes,
 * plus the scopes of their course role and the ones assigned to their enrollment.
 * Being enrolled grants nothing by itself.
 */
export async function getCourseScopes(userId: string, courseId: string): Promise<ReadonlySet<Scope>> {
  const global = await getGlobalScopes(userId);
  const scopes = new Set([...global].filter(isCourseScope));

  const [membership] = await db
    .select({ id: enrollment.id, roleId: enrollment.roleId })
    .from(enrollment)
    .where(and(eq(enrollment.userId, userId), eq(enrollment.courseId, courseId)));
  if (!membership) return scopes;

  const [byRole, extra] = await Promise.all([
    scopesOfRoles([membership.roleId]),
    db
      .select({ scope: enrollmentScope.scope })
      .from(enrollmentScope)
      .where(eq(enrollmentScope.enrollmentId, membership.id)),
  ]);
  const granted = [...(byRole.get(membership.roleId) ?? []), ...parseScopes(extra.map((row) => row.scope))];
  for (const scope of granted) if (isCourseScope(scope)) scopes.add(scope);
  return scopes;
}
