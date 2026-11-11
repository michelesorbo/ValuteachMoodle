import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";

/** Liveness/readiness probe for Coolify: 200 only when the database answers. */
export async function GET() {
  await connection();
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "error" }, { status: 503 });
  }
}
