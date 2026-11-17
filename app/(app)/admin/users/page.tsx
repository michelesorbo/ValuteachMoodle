import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { getFormatter, getTranslations } from "next-intl/server";
import { db, schema } from "@/db";
import { listRolesWithScopes } from "@/modules/auth/access";
import { requireScope } from "@/modules/auth/session";
import { PageFallback } from "../../page-fallback";
import { linkClass } from "../../ui";
import { CreateUserForm } from "./create-user-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("titles");
  return { title: t("users") };
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <AdminUsers />
    </Suspense>
  );
}

async function AdminUsers() {
  const { scopes: mine } = await requireScope("users:manage");
  const t = await getTranslations("admin.users");
  const format = await getFormatter();

  const [users, assignments, roles] = await Promise.all([
    db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        createdAt: schema.user.createdAt,
      })
      .from(schema.user)
      .orderBy(asc(schema.user.name)),
    db.select().from(schema.userRole),
    listRolesWithScopes("global"),
  ]);
  const roleName = new Map(roles.map((role) => [role.id, role.name]));
  const rolesOf = (userId: string) =>
    assignments
      .filter((entry) => entry.userId === userId)
      .map((entry) => roleName.get(entry.roleId))
      .filter(Boolean)
      .join(", ");
  // Only roles whose scopes the current user holds can be handed out.
  const assignable = roles.filter((role) => role.scopes.every((scope) => mine.has(scope)));

  return (
    <>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">{t("listCaption")}</caption>
          <thead>
            <tr className="border-b border-neutral-400">
              <th scope="col" className="py-2 pr-4 font-medium">{t("name")}</th>
              <th scope="col" className="py-2 pr-4 font-medium">{t("email")}</th>
              <th scope="col" className="py-2 pr-4 font-medium">{t("roles")}</th>
              <th scope="col" className="py-2 pr-4 font-medium">{t("createdAt")}</th>
              <th scope="col" className="py-2 font-medium">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-neutral-200">
                <td className="py-2 pr-4">{user.name}</td>
                <td className="py-2 pr-4">{user.email}</td>
                <td className="py-2 pr-4">{rolesOf(user.id) || "—"}</td>
                <td className="py-2 pr-4">{format.dateTime(user.createdAt, { dateStyle: "medium" })}</td>
                <td className="py-2">
                  <Link href={`/admin/users/${user.id}`} className={linkClass}>
                    {t("editAccess")}
                    <span className="sr-only"> {user.name}</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="mt-4 text-neutral-700">{t("empty")}</p>}
      </div>

      <CreateUserForm roles={assignable.map((role) => ({ id: role.id, name: role.name }))} />
    </>
  );
}
