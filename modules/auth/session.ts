import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getGlobalScopes } from "./access";
import { auth, type SessionUser } from "./auth";
import type { Scope } from "./scopes";

/**
 * Data-access layer for the session. Every page, server action and route handler
 * must go through these helpers: UI checks alone never protect data.
 * Reads the request, so callers must render behind a <Suspense> boundary.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Requires a signed-in user holding the given global scope; otherwise sends them home. */
export async function requireScope(scope: Scope): Promise<{ user: SessionUser; scopes: ReadonlySet<Scope> }> {
  const user = await requireUser();
  const scopes = await getGlobalScopes(user.id);
  if (!scopes.has(scope)) redirect("/");
  return { user, scopes };
}
