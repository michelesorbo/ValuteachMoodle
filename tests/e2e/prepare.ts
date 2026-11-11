/**
 * Prepares a clean environment for the end-to-end tests: recreates the test database,
 * applies the migrations, empties the test storage directory and seeds the users.
 * Run by `pnpm e2e:server` before the server starts. Refuses to touch anything that
 * is not clearly a test database or directory.
 */
import { rm } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { USERS } from "./users";

async function main() {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
  const database = databaseUrl.pathname.slice(1);
  const filesDir = path.resolve(process.env.FILES_DIR ?? "");
  const password = process.env.E2E_PASSWORD;

  if (!/^[a-z0-9_]+_e2e$/.test(database)) throw new Error(`Refusing to reset database "${database}"`);
  if (!path.basename(filesDir).includes("e2e")) throw new Error(`Refusing to empty "${filesDir}"`);
  if (!password) throw new Error("E2E_PASSWORD must be set");

  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/postgres";
  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  await client.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
  await client.query(`CREATE DATABASE "${database}"`);
  await client.end();

  await rm(filesDir, { recursive: true, force: true });

  // Imported only now: these modules read DATABASE_URL when they load.
  const { runMigrations } = await import("../../db/migrate");
  const { pool } = await import("../../db");
  const { ensureUser } = await import("../../modules/auth/ensure-user");
  await runMigrations();
  for (const user of Object.values(USERS)) {
    await ensureUser({ ...user, password });
  }
  await pool.end();
  console.log(`[e2e] database "${database}" ready`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
