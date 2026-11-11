"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createUserAction, type CreateUserState } from "@/modules/auth/actions";
import { GLOBAL_ROLES, MIN_PASSWORD_LENGTH } from "@/modules/auth/roles";

const initialState: CreateUserState = { status: "idle" };
const inputClass = "rounded border border-neutral-500 px-3 py-2";

export function CreateUserForm() {
  const t = useTranslations("admin.users");
  const [state, formAction, pending] = useActionState(createUserAction, initialState);

  return (
    <section aria-labelledby="nuovo-utente" className="mt-10 max-w-md">
      <h2 id="nuovo-utente" className="text-xl font-semibold">
        {t("create.title")}
      </h2>
      {/* The key resets the fields after a successful creation. */}
      <form
        key={state.status === "success" ? "done" : "form"}
        action={formAction}
        className="mt-4 flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="new-name" className="text-sm font-medium">{t("name")}</label>
          <input id="new-name" name="name" required maxLength={200} autoComplete="off" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="new-email" className="text-sm font-medium">{t("email")}</label>
          <input id="new-email" name="email" type="email" required autoComplete="off" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="new-password" className="text-sm font-medium">{t("create.password")}</label>
          <input
            id="new-password"
            name="password"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            maxLength={128}
            autoComplete="new-password"
            aria-describedby="new-password-hint"
            className={inputClass}
          />
          <p id="new-password-hint" className="text-sm text-neutral-700">
            {t("create.passwordHint", { min: MIN_PASSWORD_LENGTH })}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="new-role" className="text-sm font-medium">{t("role")}</label>
          <select id="new-role" name="role" defaultValue="user" className={inputClass}>
            {GLOBAL_ROLES.map((role) => (
              <option key={role} value={role}>
                {t(`roles.${role}`)}
              </option>
            ))}
          </select>
        </div>
        <p role="status" className="min-h-5 text-sm">
          {state.status === "success" && <span className="text-green-800">{t("create.success")}</span>}
          {state.status === "error" && (
            <span className="text-red-700">{t(`create.errors.${state.error}`)}</span>
          )}
        </p>
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded bg-blue-700 px-4 py-2 font-medium text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {pending ? t("create.submitting") : t("create.submit")}
        </button>
      </form>
    </section>
  );
}
