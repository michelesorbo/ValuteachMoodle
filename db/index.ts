import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pgPool?: Pool };

// The pool connects lazily on first query, so importing this module never needs a live database.
const pool = globalForDb.pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL });

// Reuse the pool across hot reloads in development.
if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;

export const db = drizzle(pool, { schema });
export { pool, schema };
