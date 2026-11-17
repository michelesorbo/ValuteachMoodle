"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createUserAction, type CreateUserState } from "@/modules/auth/actions";
import { MIN_PASSWORD_LENGTH } from "@/modules/auth/roles";

const initialState: CreateUserState = { status: "idle" };
const inputClass = "rounded border border-neutral-500 px-3 py-2";

export function CreateUserForm({ roles }: { roles: { id: string; name: string }[] }) {
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
        {roles.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">{t("roles")}</legend>
            {roles.map((role) => (
              <label key={role.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="roleIds" value={role.id} />
                {role.name}
              </label>
            ))}
          </fieldset>
        )}
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
