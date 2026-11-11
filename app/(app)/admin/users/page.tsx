import type { Metadata } from "next";
import { Suspense } from "react";
import { asc } from "drizzle-orm";
import { getFormatter, getTranslations } from "next-intl/server";
import { db, schema } from "@/db";
import { isAdmin } from "@/modules/auth/roles";
import { requireAdmin } from "@/modules/auth/session";
import { PageFallback } from "../../page-fallback";
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
  await requireAdmin();
  const t = await getTranslations("admin.users");
  const format = await getFormatter();

  const users = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      role: schema.user.role,
      createdAt: schema.user.createdAt,
    })
    .from(schema.user)
    .orderBy(asc(schema.user.name));

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
              <th scope="col" className="py-2 pr-4 font-medium">{t("role")}</th>
              <th scope="col" className="py-2 font-medium">{t("createdAt")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-neutral-200">
                <td className="py-2 pr-4">{user.name}</td>
                <td className="py-2 pr-4">{user.email}</td>
                <td className="py-2 pr-4">{t(isAdmin(user) ? "roles.admin" : "roles.user")}</td>
                <td className="py-2">{format.dateTime(user.createdAt, { dateStyle: "medium" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="mt-4 text-neutral-700">{t("empty")}</p>}
      </div>

      <CreateUserForm />
    </>
  );
}
