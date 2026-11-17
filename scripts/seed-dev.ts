/**
 * Development only: creates two regular users to try course roles by hand
 * (and, later, for the end-to-end tests). Never run against production.
 * Usage: pnpm seed:dev   — reads SEED_DEV_PASSWORD (shared by both users).
 */
import { pool } from "../db";
import { ensureUser } from "../modules/auth/ensure-user";

const DEV_USERS = [
  { email: "docente@newlms.test", name: "Docente Prova" },
  { email: "studente@newlms.test", name: "Studente Prova" },
] as const;

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("seed:dev must not run in production");
  const password = process.env.SEED_DEV_PASSWORD;
  if (!password) throw new Error("SEED_DEV_PASSWORD must be set");

  for (const user of DEV_USERS) {
    const result = await ensureUser({ ...user, password });
    console.log(`${user.email}: ${result}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
