import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireScope } from "@/modules/auth/session";
import { createCourseAction } from "@/modules/courses/actions";
import { ActionForm } from "../../action-form";
import { PageFallback } from "../../page-fallback";
import { fieldClass, inputClass, labelClass, linkClass } from "../../ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("titles");
  return { title: t("newCourse") };
}

export default function NewCoursePage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <NewCourse />
    </Suspense>
  );
}

async function NewCourse() {
  await requireScope("courses:create");
  const t = await getTranslations("courses");

  return (
    <div className="max-w-xl">
      <p>
        <Link href="/" className={linkClass}>
          {t("new.back")}
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold">{t("new.title")}</h1>
      <ActionForm action={createCourseAction} submitLabel={t("new.submit")} className="mt-6 flex flex-col gap-4">
        <div className={fieldClass}>
          <label htmlFor="course-title" className={labelClass}>
            {t("fields.title")}
          </label>
          <input id="course-title" name="title" required maxLength={200} className={inputClass} />
        </div>
        <div className={fieldClass}>
          <label htmlFor="course-description" className={labelClass}>
            {t("fields.description")}
          </label>
          <textarea id="course-description" name="description" rows={4} maxLength={5000} className={inputClass} />
        </div>
      </ActionForm>
    </div>
  );
}
