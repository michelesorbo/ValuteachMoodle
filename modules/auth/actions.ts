"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { failure, success, type FormState } from "@/modules/shared/form-state";
import { listRolesWithScopes } from "./access";
import { createAccount } from "./ensure-user";
import { MIN_PASSWORD_LENGTH } from "./roles";
import { canGrant, parseScopes } from "./scopes";
import { requireScope } from "./session";

const createUserSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(128),
});

export type CreateUserState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; error: "invalid" | "emailTaken" | "forbidden" | "generic" };

/** Global roles ticked in the form, with the scopes they grant. null if any is not a global role. */
async function readGlobalRoles(formData: FormData) {
  const ids = [...new Set(formData.getAll("roleIds").map(String))];
  if (!ids.every((id) => z.uuid().safeParse(id).success)) return null;
  const roles = (await listRolesWithScopes("global")).filter((role) => ids.includes(role.id));
  if (roles.length !== ids.length) return null;
  return { ids, scopes: roles.flatMap((role) => role.scopes) };
}

/** Needs `users:manage`. The new user can only get roles whose scopes the actor holds. */
export async function createUserAction(
  _previous: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  const { scopes: actorScopes } = await requireScope("users:manage");

  const parsed = createUserSchema.safeParse(Object.fromEntries(formData));
  const roles = await readGlobalRoles(formData);
  if (!parsed.success || !roles) return { status: "error", error: "invalid" };
  if (!canGrant(actorScopes, roles.scopes)) return { status: "error", error: "forbidden" };

  try {
    const created = await createAccount(parsed.data, roles.ids);
    if (!created) return { status: "error", error: "emailTaken" };
  } catch (error) {
    console.error("[auth] createUser failed", error);
    return { status: "error", error: "generic" };
  }

  revalidatePath("/admin/users");
  return { status: "success" };
}

/**
 * Needs `users:manage`. Replaces the global roles and the direct scopes of a user.
 * Everything that is added or removed must be within the actor's own scopes, and
 * nobody can change their own access (so the last administrator cannot lock themselves out).
 */
export async function updateUserAccessAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const { user: actor, scopes: actorScopes } = await requireScope("users:manage");

  const userId = z.string().min(1).max(100).safeParse(formData.get("userId"));
  const roles = await readGlobalRoles(formData);
  const values = formData.getAll("scopes").map(String);
  const direct = parseScopes(values);
  if (!userId.success || !roles || direct.length !== values.length) return failure("invalid");
  if (userId.data === actor.id) return failure("forbidden");

  const [target] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.id, userId.data));
  if (!target) return failure("notFound");

  const [currentRoleRows, currentScopeRows, allGlobal] = await Promise.all([
    db.select({ roleId: schema.userRole.roleId }).from(schema.userRole).where(eq(schema.userRole.userId, target.id)),
    db.select({ scope: schema.userScope.scope }).from(schema.userScope).where(eq(schema.userScope.userId, target.id)),
    listRolesWithScopes("global"),
  ]);
  const touchedRoleIds = new Set([...currentRoleRows.map((row) => row.roleId), ...roles.ids]);
  const touched: string[] = [
    ...allGlobal.filter((role) => touchedRoleIds.has(role.id)).flatMap((role) => role.scopes),
    ...parseScopes(currentScopeRows.map((row) => row.scope)),
    ...direct,
  ];
  if (!canGrant(actorScopes, touched)) return failure("forbidden");

  await db.transaction(async (tx) => {
    await tx.delete(schema.userRole).where(eq(schema.userRole.userId, target.id));
    if (roles.ids.length > 0) {
      await tx.insert(schema.userRole).values(roles.ids.map((roleId) => ({ userId: target.id, roleId })));
    }
    await tx.delete(schema.userScope).where(eq(schema.userScope.userId, target.id));
    if (direct.length > 0) {
      await tx.insert(schema.userScope).values(direct.map((scope) => ({ userId: target.id, scope })));
    }
  });

  revalidatePath("/", "layout");
  return success;
}
