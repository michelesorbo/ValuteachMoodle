import { eq } from "drizzle-orm";
import { db, schema } from "../../db";
import { auth } from "./auth";
import { MIN_PASSWORD_LENGTH, type GlobalRole } from "./roles";

type Input = { email: string; name: string; password: string; role: GlobalRole };

/**
 * Creates a user with email + password, bypassing the (disabled) public sign-up.
 * If the email already exists only the role is updated; the password is left alone.
 */
export async function ensureUser({ email, name, password, role }: Input): Promise<"created" | "updated"> {
  const normalized = email.trim().toLowerCase();
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password for ${normalized} must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const [existing] = await db.select().from(schema.user).where(eq(schema.user.email, normalized));
  if (existing) {
    await db.update(schema.user).set({ role }).where(eq(schema.user.id, existing.id));
    return "updated";
  }

  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser(
    { email: normalized, name, emailVerified: true, role },
    { method: "admin" },
  );
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: await ctx.password.hash(password),
  });
  return "created";
}

/**
 * First start of a new installation: creates the admin from SEED_ADMIN_EMAIL and
 * SEED_ADMIN_PASSWORD when no admin exists yet. Does nothing otherwise, so the
 * variables can stay set (though removing the password afterwards is better).
 */
export async function bootstrapAdmin(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) return;

  const [admin] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.role, "admin"))
    .limit(1);
  if (admin) return;

  await ensureUser({ email, password, name: process.env.SEED_ADMIN_NAME?.trim() || "Admin", role: "admin" });
  console.log(`[startup] first admin created: ${email}`);
}
