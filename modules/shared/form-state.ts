/** Result of a server action used with useActionState. Error codes map to messages under "errors". */
export const FORM_ERRORS = [
  "invalid",
  "forbidden",
  "notFound",
  "alreadyEnrolled",
  "generic",
] as const;

export type FormError = (typeof FORM_ERRORS)[number];

export type FormState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; error: FormError };

export const idleState: FormState = { status: "idle" };
export const success: FormState = { status: "success" };

export function failure(error: FormError): FormState {
  return { status: "error", error };
}

export type FormAction = (previous: FormState, formData: FormData) => Promise<FormState>;
