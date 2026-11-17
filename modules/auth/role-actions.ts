"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { failure, success, type FormState } from "@/modules/shared/form-state";
import { listRolesWithScopes } from "./access";
import { canGrant, parseScopes, ROLE_KINDS, scopesAllowedForKind } from "./scopes";
import { requireScope } from "./session";

const { role, roleScope } = schema;

const fields = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500),
});

/** Scopes ticked in the form, or null if any value is not in the catalog. */
function readScopes(formData: FormData) {
  const values = formData.getAll("scopes").map(String);
  const scopes = parseScopes(values);
  return scopes.length === values.length ? scopes : null;
}

function pgCode(error: unknown): string | undefined {
  const e = error as { code?: string; cause?: { code?: string } } | null;
  return e?.code ?? e?.cause?.code;
}

/** Needs `roles:manage`. A role can only contain scopes the creator holds. */
export async function createRoleAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const { scopes: actorScopes } = await requireScope("roles:manage");
  const parsed = fields.extend({ kind: z.enum(ROLE_KINDS) }).safeParse(Object.fromEntries(formData));
  const scopes = readScopes(formData);
  if (!parsed.success || !scopes || !scopesAllowedForKind(parsed.data.kind, scopes)) return failure("invalid");
  if (!canGrant(actorScopes, scopes)) return failure("forbidden");

  let id: string;
  try {
    id = await db.transaction(async (tx) => {
      const [created] = await tx.insert(role).values(parsed.data).returning({ id: role.id });
      if (scopes.length > 0) await tx.insert(roleScope).values(scopes.map((scope) => ({ roleId: created.id, scope })));
      return created.id;
    });
  } catch (error) {
    if (pgCode(error) === "23505") return failure("alreadyExists");
    throw error;
  }

  revalidatePath("/", "layout");
  redirect(`/admin/roles/${id}`);
}

/**
 * Needs `roles:manage`. The system "admin" role is computed and cannot be edited.
 * Scopes that are added or removed must be ones the actor holds.
 */
export async function updateRoleAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const { scopes: actorScopes } = await requireScope("roles:manage");
  const roleId = z.uuid().safeParse(formData.get("roleId"));
  const parsed = fields.safeParse(Object.fromEntries(formData));
  const scopes = readScopes(formData);
  if (!roleId.success || !parsed.success || !scopes) return failure("invalid");

  const [current] = (await listRolesWithScopes()).filter((entry) => entry.id === roleId.data);
  if (!current) return failure("notFound");
  if (current.systemKey === "admin") return failure("forbidden");
  if (!scopesAllowedForKind(current.kind, scopes)) return failure("invalid");

  const changed = [
    ...current.scopes.filter((scope) => !scopes.includes(scope)),
    ...scopes.filter((scope) => !current.scopes.includes(scope)),
  ];
  if (!canGrant(actorScopes, changed)) return failure("forbidden");

  try {
    await db.transaction(async (tx) => {
      await tx.update(role).set(parsed.data).where(eq(role.id, current.id));
      await tx.delete(roleScope).where(eq(roleScope.roleId, current.id));
      if (scopes.length > 0) await tx.insert(roleScope).values(scopes.map((scope) => ({ roleId: current.id, scope })));
    });
  } catch (error) {
    if (pgCode(error) === "23505") return failure("alreadyExists");
    throw error;
  }

  revalidatePath("/", "layout");
  return success;
}

/** Needs `roles:manage`. Built-in roles and roles that are still assigned cannot be deleted. */
export async function deleteRoleAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireScope("roles:manage");
  const roleId = z.uuid().safeParse(formData.get("roleId"));
  if (!roleId.success) return failure("invalid");

  const [current] = await db.select().from(role).where(eq(role.id, roleId.data));
  if (!current) return failure("notFound");
  if (current.systemKey) return failure("forbidden");

  try {
    await db.delete(role).where(eq(role.id, current.id));
  } catch (error) {
    // user_role and enrollment reference the role with ON DELETE RESTRICT: it is still in use.
    if (pgCode(error) === "23503") return failure("inUse");
    throw error;
  }

  revalidatePath("/", "layout");
  redirect("/admin/roles");
}
