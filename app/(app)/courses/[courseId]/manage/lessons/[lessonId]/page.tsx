import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/modules/auth/session";
import { getManageableCourse } from "@/modules/courses/access";
import { updateLessonAction } from "@/modules/courses/actions";
import { getLesson } from "@/modules/courses/queries";
import { ActionForm } from "../../../../../action-form";
import { PageFallback } from "../../../../../page-fallback";
import { fieldClass, inputClass, labelClass, linkClass } from "../../../../../ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("titles");
  return { title: t("editLesson") };
}

type Props = PageProps<"/courses/[courseId]/manage/lessons/[lessonId]">;

export default function EditLessonPage(props: Props) {
  return (
    <Suspense fallback={<PageFallback />}>
      <EditLesson params={props.params} />
    </Suspense>
  );
}

async function EditLesson({ params }: { params: Props["params"] }) {
  await requireUser();
  const { courseId, lessonId } = await params;
  const context = await getManageableCourse(courseId);
  if (!context) notFound();
  const found = await getLesson(lessonId);
  if (!found || found.lesson.courseId !== context.course.id) notFound();

  const { lesson, file } = found;
  const t = await getTranslations("courses");

  return (
    <div className="max-w-2xl">
      <p>
        <Link href={`/courses/${context.course.id}/manage`} className={linkClass}>
          {t("manage.title")}
        </Link>
      </p>
      <p className="mt-4 text-sm text-neutral-700">{context.course.title}</p>
      <h1 className="text-2xl font-semibold">{t("manage.editLesson")}</h1>

      <ActionForm
        action={updateLessonAction}
        submitLabel={t("manage.save")}
        successMessage={t("manage.saved")}
        className="mt-6 flex flex-col gap-4"
      >
        <input type="hidden" name="lessonId" value={lesson.id} />
        <div className={fieldClass}>
          <label htmlFor="lesson-title" className={labelClass}>
            {t("manage.lessonTitle")}
          </label>
          <input
            id="lesson-title"
            name="title"
            required
            maxLength={200}
            defaultValue={lesson.title}
            className={inputClass}
          />
        </div>
        {lesson.type === "text" && (
          <div className={fieldClass}>
            <label htmlFor="lesson-content" className={labelClass}>
              {t("manage.content")}
            </label>
            <textarea
              id="lesson-content"
              name="content"
              required
              rows={14}
              maxLength={100000}
              defaultValue={lesson.content}
              className={inputClass}
            />
          </div>
        )}
        {file && (
          <p className="text-sm text-neutral-700">
            {t("manage.file")}: {file.originalName}
          </p>
        )}
      </ActionForm>
    </div>
  );
}
