import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "../../db";
import { auth } from "./auth";
import { MIN_PASSWORD_LENGTH } from "./roles";

type NewAccount = { email: string; name: string; password: string };

/**
 * Creates a user with email + password, bypassing the (disabled) public sign-up, and
 * gives them the global roles `roleIds`. Returns null when the email is already taken.
 * Better Auth's own `role` column stays "user": authorization lives in the scopes (see scopes.ts).
 */
export async function createAccount(
  { email, name, password }: NewAccount,
  roleIds: readonly string[] = [],
): Promise<{ id: string } | null> {
  const normalized = email.trim().toLowerCase();
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password for ${normalized} must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  const [existing] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, normalized));
  if (existing) return null;

  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser(
    { email: normalized, name, emailVerified: true, role: "user" },
    { method: "admin" },
  );
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: await ctx.password.hash(password),
  });
  if (roleIds.length > 0) {
    await db.insert(schema.userRole).values(roleIds.map((roleId) => ({ userId: user.id, roleId })));
  }
  return { id: user.id };
}

type Input = NewAccount & { systemRoles?: readonly ("admin")[] };

/**
 * For seeds and tests: creates the user if missing and makes sure they hold the given
 * built-in global roles. An existing user keeps their password and their other roles.
 */
export async function ensureUser({ systemRoles = [], ...account }: Input): Promise<"created" | "updated"> {
  const roles = systemRoles.length
    ? await db.select({ id: schema.role.id }).from(schema.role).where(inArray(schema.role.systemKey, [...systemRoles]))
    : [];
  const roleIds = roles.map((row) => row.id);

  const created = await createAccount(account, roleIds);
  if (created) return "created";

  const [existing] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, account.email.trim().toLowerCase()));
  if (roleIds.length > 0) {
    await db
      .insert(schema.userRole)
      .values(roleIds.map((roleId) => ({ userId: existing.id, roleId })))
      .onConflictDoNothing();
  }
  return "updated";
}

/**
 * First start of a new installation: creates the admin from SEED_ADMIN_EMAIL and
 * SEED_ADMIN_PASSWORD when nobody holds the admin role yet. Does nothing otherwise, so the
 * variables can stay set (though removing the password afterwards is better).
 */
export async function bootstrapAdmin(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) return;

  const [admin] = await db
    .select({ id: schema.userRole.userId })
    .from(schema.userRole)
    .innerJoin(schema.role, and(eq(schema.role.id, schema.userRole.roleId), eq(schema.role.systemKey, "admin")))
    .limit(1);
  if (admin) return;

  await ensureUser({
    email,
    password,
    name: process.env.SEED_ADMIN_NAME?.trim() || "Admin",
    systemRoles: ["admin"],
  });
  console.log(`[startup] first admin created: ${email}`);
}
