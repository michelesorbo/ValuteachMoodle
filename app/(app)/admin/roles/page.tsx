import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listRolesWithScopes } from "@/modules/auth/access";
import { createRoleAction } from "@/modules/auth/role-actions";
import { requireScope } from "@/modules/auth/session";
import { ActionForm } from "../../action-form";
import { PageFallback } from "../../page-fallback";
import { ScopeChecklist } from "../../scope-checklist";
import { fieldClass, inputClass, labelClass, linkClass, sectionTitleClass } from "../../ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("titles");
  return { title: t("roles") };
}

export default function AdminRolesPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <AdminRoles />
    </Suspense>
  );
}

async function AdminRoles() {
  const { scopes: mine } = await requireScope("roles:manage");
  const t = await getTranslations("admin.roles");
  const roles = await listRolesWithScopes();

  return (
    <>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-2 max-w-3xl text-neutral-700">{t("intro")}</p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">{t("listCaption")}</caption>
          <thead>
            <tr className="border-b border-neutral-400">
              <th scope="col" className="py-2 pr-4 font-medium">{t("name")}</th>
              <th scope="col" className="py-2 pr-4 font-medium">{t("kind")}</th>
              <th scope="col" className="py-2 pr-4 font-medium">{t("scopesCount")}</th>
              <th scope="col" className="py-2 font-medium">{t("type")}</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id} className="border-b border-neutral-200">
                <th scope="row" className="py-2 pr-4 font-normal">
                  <Link href={`/admin/roles/${role.id}`} className={linkClass}>
                    {role.name}
                  </Link>
                </th>
                <td className="py-2 pr-4">{t(`kinds.${role.kind}`)}</td>
                <td className="py-2 pr-4">{role.scopes.length}</td>
                <td className="py-2">{role.systemKey ? t("system") : t("custom")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section aria-labelledby="nuovo-ruolo" className="mt-10 max-w-2xl">
        <h2 id="nuovo-ruolo" className={sectionTitleClass}>
          {t("create.title")}
        </h2>
        <ActionForm
          action={createRoleAction}
          submitLabel={t("create.submit")}
          className="mt-4 flex flex-col gap-4"
        >
          <div className={fieldClass}>
            <label htmlFor="role-name" className={labelClass}>{t("name")}</label>
            <input id="role-name" name="name" required maxLength={100} className={inputClass} />
          </div>
          <div className={fieldClass}>
            <label htmlFor="role-description" className={labelClass}>{t("description")}</label>
            <textarea id="role-description" name="description" rows={2} maxLength={500} className={inputClass} />
          </div>
          <div className={fieldClass}>
            <label htmlFor="role-kind" className={labelClass}>{t("kind")}</label>
            <select id="role-kind" name="kind" defaultValue="course" className={inputClass} aria-describedby="role-kind-hint">
              <option value="course">{t("kinds.course")}</option>
              <option value="global">{t("kinds.global")}</option>
            </select>
            <p id="role-kind-hint" className="text-sm text-neutral-700">{t("kindHint")}</p>
          </div>
          <div>
            <p className={labelClass}>{t("scopes")}</p>
            <p className="mb-2 text-sm text-neutral-700">{t("scopesHint")}</p>
            <ScopeChecklist groups={["global", "course"]} selected={[]} lockedUnless={mine} idPrefix="new-role" />
          </div>
        </ActionForm>
      </section>
    </>
  );
}
