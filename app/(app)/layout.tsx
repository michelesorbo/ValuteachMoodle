import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { isAdmin } from "@/modules/auth/roles";
import { requireUser } from "@/modules/auth/session";
import { LogoutButton } from "./logout-button";

/**
 * Layout for every authenticated page. The session is read at request time, so
 * the user-dependent header streams in behind its own Suspense boundary, while
 * each page wraps its own request-time content in <Suspense> (see PageFallback).
 * Pages must still call requireUser()/requireAdmin() themselves: a layout does
 * not protect the pages below it.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-neutral-300">
        <div className="mx-auto flex min-h-14 w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Suspense fallback={<AppName />}>
            <HeaderContent />
          </Suspense>
        </div>
      </header>
      <main id="contenuto" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
    </>
  );
}

async function AppName() {
  const t = await getTranslations("app");
  return <span className="text-lg font-semibold">{t("name")}</span>;
}

async function HeaderContent() {
  const user = await requireUser();
  const t = await getTranslations("nav");

  return (
    <>
      <AppName />
      <nav aria-label={t("main")} className="flex gap-4">
        <Link href="/" className="underline-offset-4 hover:underline">
          {t("home")}
        </Link>
        {isAdmin(user) && (
          <Link href="/admin/users" className="underline-offset-4 hover:underline">
            {t("users")}
          </Link>
        )}
      </nav>
      <div className="ml-auto flex items-center gap-3 text-sm">
        <span className="text-neutral-700">{t("signedInAs", { name: user.name })}</span>
        <LogoutButton />
      </div>
    </>
  );
}
