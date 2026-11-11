import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/modules/auth/session";
import { getViewableCourse } from "@/modules/courses/access";
import { canManageCourse, canTrackProgress } from "@/modules/courses/permissions";
import { listCompletedLessonIds, listLessons } from "@/modules/courses/queries";
import { computeCourseProgress } from "@/modules/progress/progress";
import { CourseProgressBar } from "../../course-progress";
import { PageFallback } from "../../page-fallback";
import { buttonClasses, linkClass, sectionTitleClass } from "../../ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("titles");
  return { title: t("course") };
}

type Props = PageProps<"/courses/[courseId]">;

export default function CoursePage(props: Props) {
  return (
    <Suspense fallback={<PageFallback />}>
      <CourseDetail params={props.params} />
    </Suspense>
  );
}

async function CourseDetail({ params }: { params: Props["params"] }) {
  const user = await requireUser();
  const { courseId } = await params;
  // Users who are not enrolled get a 404, so the course's existence is not revealed.
  const context = await getViewableCourse(courseId);
  if (!context) notFound();

  const { course, access } = context;
  const t = await getTranslations("courses");
  const lessons = await listLessons(course.id);
  const tracksProgress = canTrackProgress(access);
  const completed = new Set(tracksProgress ? await listCompletedLessonIds(course.id, user.id) : []);

  return (
    <>
      <p>
        <Link href="/" className={linkClass}>
          {t("detail.back")}
        </Link>
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-semibold">{course.title}</h1>
        {canManageCourse(access) && (
          <Link href={`/courses/${course.id}/manage`} className={buttonClasses.secondary}>
            {t("detail.manage")}
          </Link>
        )}
      </div>
      {course.description && (
        <p className="mt-3 max-w-3xl whitespace-pre-wrap text-neutral-800">{course.description}</p>
      )}
      {tracksProgress && (
        <div className="mt-4">
          <CourseProgressBar
            progress={computeCourseProgress(
              lessons.map((lesson) => lesson.id),
              completed,
            )}
          />
        </div>
      )}

      <h2 className={`mt-8 ${sectionTitleClass}`}>{t("detail.lessons")}</h2>
      {lessons.length === 0 ? (
        <p className="mt-3 text-neutral-700">{t("detail.noLessons")}</p>
      ) : (
        <ol className="mt-3 divide-y divide-neutral-200 border-y border-neutral-200">
          {lessons.map((lesson, index) => (
            <li key={lesson.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
              <span className="w-6 text-neutral-700">{index + 1}.</span>
              <Link href={`/courses/${course.id}/lessons/${lesson.id}`} className={linkClass}>
                {lesson.title}
              </Link>
              <span className="text-sm text-neutral-700">{t(`lessonTypes.${lesson.type}`)}</span>
              {tracksProgress && (
                <span
                  className={`ml-auto text-sm ${completed.has(lesson.id) ? "font-semibold text-green-800" : "text-neutral-700"}`}
                >
                  {completed.has(lesson.id) ? `✓ ${t("detail.completed")}` : t("detail.toDo")}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
