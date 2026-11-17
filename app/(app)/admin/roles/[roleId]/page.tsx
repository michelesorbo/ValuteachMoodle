import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { listRolesWithScopes } from "@/modules/auth/access";
import { deleteRoleAction, updateRoleAction } from "@/modules/auth/role-actions";
import { requireScope } from "@/modules/auth/session";
import { isUuid } from "@/modules/courses/access";
import { ActionForm } from "../../../action-form";
import { PageFallback } from "../../../page-fallback";
import { ScopeChecklist } from "../../../scope-checklist";
import { fieldClass, inputClass, labelClass, linkClass } from "../../../ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("titles");
  return { title: t("editRole") };
}

type Props = PageProps<"/admin/roles/[roleId]">;

export default function EditRolePage(props: Props) {
  return (
    <Suspense fallback={<PageFallback />}>
      <EditRole params={props.params} />
    </Suspense>
  );
}

async function EditRole({ params }: { params: Props["params"] }) {
  const { scopes: mine } = await requireScope("roles:manage");
  const { roleId } = await params;
  const role = isUuid(roleId) ? (await listRolesWithScopes()).find((entry) => entry.id === roleId) : undefined;
  if (!role) notFound();

  const t = await getTranslations("admin.roles");
  // The admin role is computed from the catalog, so it is shown but never edited.
  const locked = role.systemKey === "admin";

  return (
    <div className="max-w-2xl">
      <p>
        <Link href="/admin/roles" className={linkClass}>
          {t("back")}
        </Link>
      </p>
      <p className="mt-4 text-sm text-neutral-700">
        {t(`kinds.${role.kind}`)} · {role.systemKey ? t("system") : t("custom")}
      </p>
      <h1 className="text-2xl font-semibold">{role.name}</h1>
      {locked && <p className="mt-2 text-neutral-700">{t("adminLocked")}</p>}

      <ActionForm
        action={updateRoleAction}
        submitLabel={t("edit.save")}
        successMessage={t("edit.saved")}
        className="mt-6 flex flex-col gap-4"
      >
        <input type="hidden" name="roleId" value={role.id} />
        <div className={fieldClass}>
          <label htmlFor="role-name" className={labelClass}>{t("name")}</label>
          <input
            id="role-name"
            name="name"
            required
            maxLength={100}
            defaultValue={role.name}
            readOnly={locked}
            className={inputClass}
          />
        </div>
        <div className={fieldClass}>
          <label htmlFor="role-description" className={labelClass}>{t("description")}</label>
          <textarea
            id="role-description"
            name="description"
            rows={2}
            maxLength={500}
            defaultValue={role.description}
            readOnly={locked}
            className={inputClass}
          />
        </div>
        <div>
          <p className={labelClass}>{t("scopes")}</p>
          <div className="mt-2">
            <ScopeChecklist
              groups={role.kind === "global" ? ["global", "course"] : ["course"]}
              selected={role.scopes}
              lockedUnless={mine}
              readOnly={locked}
              idPrefix="role"
            />
          </div>
        </div>
      </ActionForm>

      {!role.systemKey && (
        <div className="mt-6">
          <ActionForm
            action={deleteRoleAction}
            submitLabel={t("edit.delete")}
            confirmMessage={t("edit.deleteConfirm", { name: role.name })}
            variant="danger"
            inline
          >
            <input type="hidden" name="roleId" value={role.id} />
          </ActionForm>
        </div>
      )}
    </div>
  );
}
