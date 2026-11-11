import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";
import { db, schema } from "../../db";
import { MIN_PASSWORD_LENGTH } from "./roles";

/**
 * Better Auth server instance.
 * - Email + password only in the MVP; social providers can be added under `socialProviders` later.
 * - Public sign-up is disabled: accounts are created by an admin (admin plugin).
 * - Secret and base URL come from BETTER_AUTH_SECRET / BETTER_AUTH_URL.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
  },
  // nextCookies must stay last: it lets server actions set auth cookies.
  plugins: [admin(), nextCookies()],
});

export type SessionUser = typeof auth.$Infer.Session.user;
