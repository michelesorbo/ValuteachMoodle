"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { authClient } from "@/modules/auth/client";

export function LoginForm() {
  const t = useTranslations("auth.login");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<"error" | "tooManyAttempts" | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setFailure(null);

    const { error } = await authClient.signIn.email({
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? ""),
    });

    if (error) {
      // 429: Better Auth limits repeated sign-in attempts.
      setFailure(error.status === 429 ? "tooManyAttempts" : "error");
      setPending(false);
      return;
    }
    // Full page load, so nothing cached for a previous session survives the login.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate hard navigation
    window.location.assign("/");
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          {t("email")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="rounded border border-neutral-500 px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          {t("password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded border border-neutral-500 px-3 py-2"
        />
      </div>
      <p role="alert" className="min-h-5 text-sm text-red-700">
        {failure ? t(failure) : ""}
      </p>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-blue-700 px-4 py-2 font-medium text-white hover:bg-blue-800 disabled:opacity-60"
      >
        {pending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
