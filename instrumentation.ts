/**
 * Runs once when the server starts. In the production container (RUN_MIGRATIONS=1)
 * it validates the environment, applies pending database migrations and creates
 * the first admin (if SEED_ADMIN_* are set and there is none) before serving requests. In development use `pnpm db:migrate` instead.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.RUN_MIGRATIONS !== "1") return;

  const { env } = await import("./modules/config/env");
  env();

  const { runMigrations } = await import("./db/migrate");
  await runMigrations();
  console.log("[startup] database migrations applied");

  const { bootstrapAdmin } = await import("./modules/auth/ensure-user");
  await bootstrapAdmin();
}
