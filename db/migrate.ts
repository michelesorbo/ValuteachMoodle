import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./index";

/** Applies pending SQL migrations from db/migrations. Used at container start (see instrumentation.ts). */
export async function runMigrations() {
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "db", "migrations") });
}
