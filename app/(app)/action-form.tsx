"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { idleState, type FormAction } from "@/modules/shared/form-state";
import { buttonClasses, type ButtonVariant } from "./ui";

type Props = {
  action: FormAction;
  submitLabel: string;
  /** Shown after a successful submission. */
  successMessage?: string;
  /** Asks for confirmation before submitting (destructive actions). */
  confirmMessage?: string;
  variant?: ButtonVariant;
  /** Compact layout for a single button inside a list or table row. */
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
};

/**
 * A form bound to a server action: handles the pending state and shows the
 * translated error (or the success message) in a live region.
 */
export function ActionForm({
  action,
  submitLabel,
  successMessage,
  confirmMessage,
  variant = "primary",
  inline = false,
  className,
  children,
}: Props) {
  const t = useTranslations("errors");
  const [state, formAction, pending] = useActionState(action, idleState);

  const message =
    state.status === "error" ? (
      <span className="text-red-700">{t(state.error)}</span>
    ) : state.status === "success" && successMessage ? (
      <span className="text-green-800">{successMessage}</span>
    ) : null;

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
      }}
      className={className ?? (inline ? "inline-flex items-center gap-2" : "flex flex-col gap-4")}
    >
      {children}
      {inline ? (
        <>
          <button type="submit" disabled={pending} className={buttonClasses[variant]}>
            {submitLabel}
          </button>
          <span role="status" className="text-sm">
            {message}
          </span>
        </>
      ) : (
        <>
          <p role="status" className="min-h-5 text-sm">
            {message}
          </p>
          <button type="submit" disabled={pending} className={`self-start ${buttonClasses[variant]}`}>
            {submitLabel}
          </button>
        </>
      )}
    </form>
  );
}
