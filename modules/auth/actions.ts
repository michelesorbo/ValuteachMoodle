"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { auth } from "./auth";
import { GLOBAL_ROLES, MIN_PASSWORD_LENGTH } from "./roles";
import { requireAdmin } from "./session";

const createUserSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(128),
  role: z.enum(GLOBAL_ROLES),
});

export type CreateUserState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; error: "invalid" | "emailTaken" | "generic" };

/** Admin-only: creates an account (public sign-up is disabled). */
export async function createUserAction(
  _previous: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  await requireAdmin();

  const parsed = createUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "invalid" };

  try {
    await auth.api.createUser({ body: parsed.data, headers: await headers() });
  } catch (error) {
    if (error instanceof APIError && String(error.body?.code ?? "").includes("ALREADY_EXISTS")) {
      return { status: "error", error: "emailTaken" };
    }
    console.error("[auth] createUser failed", error);
    return { status: "error", error: "generic" };
  }

  revalidatePath("/admin/users");
  return { status: "success" };
}
