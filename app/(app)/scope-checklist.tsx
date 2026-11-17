import { useTranslations } from "next-intl";
import { COURSE_SCOPES, GLOBAL_SCOPES, type Scope } from "@/modules/auth/scopes";

type Props = {
  /** Which groups to offer: course roles can only hold course scopes. */
  groups: readonly ("global" | "course")[];
  selected: readonly Scope[];
  /** Scopes the current user may not hand out: shown, but they cannot be changed. */
  lockedUnless?: ReadonlySet<Scope>;
  /** Everything read-only (for example the computed admin role). */
  readOnly?: boolean;
  /** Prefix that keeps element ids unique when several checklists share a page. */
  idPrefix: string;
};

/** Checkboxes named "scopes", grouped as global and course scopes. Submitted with the form. */
export function ScopeChecklist({ groups, selected, lockedUnless, readOnly = false, idPrefix }: Props) {
  const t = useTranslations("scopes");

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => {
        const scopes: readonly Scope[] = group === "global" ? GLOBAL_SCOPES : COURSE_SCOPES;
        return (
          <fieldset key={group} className="rounded border border-neutral-300 p-3">
            <legend className="px-1 text-sm font-medium">{t(`groups.${group}`)}</legend>
            <ul className="flex flex-col gap-2">
              {scopes.map((scope) => {
                const checked = selected.includes(scope);
                const disabled = readOnly || (lockedUnless !== undefined && !lockedUnless.has(scope));
                const id = `${idPrefix}-${scope}`;
                return (
                  <li key={scope} className="flex items-start gap-2">
                    <input
                      id={id}
                      type="checkbox"
                      name={disabled ? undefined : "scopes"}
                      value={scope}
                      defaultChecked={checked}
                      disabled={disabled}
                      aria-describedby={`${id}-hint`}
                      className="mt-1"
                    />
                    {/* A disabled box is not submitted: keep what is already granted. */}
                    {disabled && checked && !readOnly && <input type="hidden" name="scopes" value={scope} />}
                    <label htmlFor={id} className="flex flex-col">
                      <span className="text-sm font-medium">{t(`items.${scope}.name`)}</span>
                      <span id={`${id}-hint`} className="text-sm text-neutral-700">
                        {t(`items.${scope}.description`)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        );
      })}
    </div>
  );
}
