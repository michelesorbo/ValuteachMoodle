/**
 * Creates the first admin (or promotes an existing user with that email).
 * Usage: pnpm seed:admin   — reads SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_ADMIN_NAME.
 */
import { pool } from "../db";
import { ensureUser } from "../modules/auth/ensure-user";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME?.trim() || "Admin";
  if (!email || !password) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set");
  }

  const result = await ensureUser({ email, name, password, role: "admin" });
  console.log(
    result === "created"
      ? `Admin ${email} created.`
      : `User ${email} already exists: role set to admin (password unchanged).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
