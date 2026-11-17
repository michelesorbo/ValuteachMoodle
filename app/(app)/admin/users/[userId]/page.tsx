import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db, schema } from "@/db";
import { listRolesWithScopes } from "@/modules/auth/access";
import { updateUserAccessAction } from "@/modules/auth/actions";
import { parseScopes } from "@/modules/auth/scopes";
import { requireScope } from "@/modules/auth/session";
import { ActionForm } from "../../../action-form";
import { PageFallback } from "../../../page-fallback";
import { ScopeChecklist } from "../../../scope-checklist";
import { linkClass } from "../../../ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("titles");
  return { title: t("editUser") };
}

type Props = PageProps<"/admin/users/[userId]">;

export default function EditUserPage(props: Props) {
  return (
    <Suspense fallback={<PageFallback />}>
      <EditUser params={props.params} />
    </Suspense>
  );
}

async function EditUser({ params }: { params: Props["params"] }) {
  const { user: actor, scopes: mine } = await requireScope("users:manage");
  const { userId } = await params;
  const [target] = await db.select().from(schema.user).where(eq(schema.user.id, userId));
  if (!target) notFound();

  const t = await getTranslations("admin.users");
  const [roles, assignedRoles, assignedScopes] = await Promise.all([
    listRolesWithScopes("global"),
    db.select({ roleId: schema.userRole.roleId }).from(schema.userRole).where(eq(schema.userRole.userId, target.id)),
    db.select({ scope: schema.userScope.scope }).from(schema.userScope).where(eq(schema.userScope.userId, target.id)),
  ]);
  const heldRoleIds = new Set(assignedRoles.map((row) => row.roleId));
  const isSelf = target.id === actor.id;

  return (
    <div className="max-w-2xl">
      <p>
        <Link href="/admin/users" className={linkClass}>
          {t("back")}
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold">{target.name}</h1>
      <p className="text-neutral-700">{target.email}</p>
      {isSelf && <p className="mt-2 text-neutral-700">{t("selfLocked")}</p>}

      <ActionForm
        action={updateUserAccessAction}
        submitLabel={t("access.save")}
        successMessage={t("access.saved")}
        className="mt-6 flex flex-col gap-6"
      >
        <input type="hidden" name="userId" value={target.id} />

        <fieldset className="flex flex-col gap-2">
          <legend className="text-lg font-semibold">{t("access.roles")}</legend>
          <p className="text-sm text-neutral-700">{t("access.rolesHint")}</p>
          {roles.map((role) => {
            const allowed = role.scopes.every((scope) => mine.has(scope));
            const held = heldRoleIds.has(role.id);
            return (
              <label key={role.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name={allowed && !isSelf ? "roleIds" : undefined}
                  value={role.id}
                  defaultChecked={held}
                  disabled={!allowed || isSelf}
                  className="mt-1"
                />
                {(!allowed || isSelf) && held && <input type="hidden" name="roleIds" value={role.id} />}
                <span className="flex flex-col">
                  <span className="font-medium">{role.name}</span>
                  {role.description && <span className="text-neutral-700">{role.description}</span>}
                </span>
              </label>
            );
          })}
        </fieldset>

        <div>
          <h2 className="text-lg font-semibold">{t("access.scopes")}</h2>
          <p className="mb-2 text-sm text-neutral-700">{t("access.scopesHint")}</p>
          <ScopeChecklist
            groups={["global", "course"]}
            selected={parseScopes(assignedScopes.map((row) => row.scope))}
            lockedUnless={isSelf ? new Set() : mine}
            idPrefix="user"
          />
        </div>
      </ActionForm>
    </div>
  );
}
