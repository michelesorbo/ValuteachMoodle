import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { isAdmin } from "@/modules/auth/roles";
import { requireUser } from "@/modules/auth/session";
import { canTrackProgress } from "@/modules/courses/permissions";
import { listCoursesFor } from "@/modules/courses/queries";
import { CourseProgressBar } from "./course-progress";
import { PageFallback } from "./page-fallback";
import { buttonClasses, linkClass } from "./ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("titles");
  return { title: t("courses") };
}

export default function HomePage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <CourseList />
    </Suspense>
  );
}

async function CourseList() {
  const user = await requireUser();
  const admin = isAdmin(user);
  const t = await getTranslations("courses");
  const courses = await listCoursesFor(user);

  return (
    <>
      <h1 className="text-2xl font-semibold">{t("list.title", { name: user.name })}</h1>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <h2 className="text-xl font-semibold">{t(admin ? "list.subtitleAdmin" : "list.subtitle")}</h2>
        {admin && (
          <Link href="/courses/new" className={buttonClasses.secondary}>
            {t("list.new")}
          </Link>
        )}
      </div>

      {courses.length === 0 ? (
        <p className="mt-4 text-neutral-700">{t(admin ? "list.emptyAdmin" : "list.empty")}</p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {courses.map((course) => (
            <li key={course.id} className="flex flex-col gap-2 rounded border border-neutral-300 p-4">
              <h3 className="text-lg font-semibold">
                <Link href={`/courses/${course.id}`} className={linkClass}>
                  {course.title}
                </Link>
              </h3>
              {course.description && (
                <p className="line-clamp-3 text-sm text-neutral-700">{course.description}</p>
              )}
              <p className="text-sm text-neutral-700">
                {t("list.yourRole", { role: t(`roles.${course.role ?? "admin"}`) })}
              </p>
              {canTrackProgress({ isAdmin: admin, role: course.role }) && (
                <CourseProgressBar progress={course.progress} />
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
