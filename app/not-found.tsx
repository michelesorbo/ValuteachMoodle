import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("titles");
  return { title: t("notFound") };
}

/** Shown for unknown URLs and for resources the user may not see (see getViewableCourse). */
export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-3 text-neutral-700">{t("description")}</p>
      <p className="mt-6">
        <Link href="/" className="text-blue-800 underline underline-offset-4 hover:text-blue-950">
          {t("back")}
        </Link>
      </p>
    </div>
  );
}
