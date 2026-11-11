import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { requireUser } from "@/modules/auth/session";
import { getViewableCourse } from "@/modules/courses/access";
import { canTrackProgress } from "@/modules/courses/permissions";
import { getLesson, isLessonCompleted } from "@/modules/courses/queries";
import { markLessonCompletedAction } from "@/modules/progress/actions";
import { isManuallyCompletable } from "@/modules/progress/progress";
import { loadVideoProgress } from "@/modules/progress/video-store";
import { scormOrigin } from "@/modules/scorm/origin";
import { createScormLaunchUrl } from "@/modules/scorm/session";
import { ActionForm } from "../../../../action-form";
import { PageFallback } from "../../../../page-fallback";
import { linkClass } from "../../../../ui";
import { ScormFrame } from "./scorm-frame";
import { VideoPlayer } from "./video-player";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("titles");
  return { title: t("lesson") };
}

type Props = PageProps<"/courses/[courseId]/lessons/[lessonId]">;

export default function LessonPage(props: Props) {
  return (
    <Suspense fallback={<PageFallback />}>
      <LessonDetail params={props.params} />
    </Suspense>
  );
}

async function LessonDetail({ params }: { params: Props["params"] }) {
  const user = await requireUser();
  const { courseId, lessonId } = await params;
  const context = await getViewableCourse(courseId);
  if (!context) notFound();
  const found = await getLesson(lessonId);
  if (!found || found.lesson.courseId !== context.course.id) notFound();

  const { lesson, file, scorm } = found;
  const t = await getTranslations("courses");
  const format = await getFormatter();
  const isStudent = canTrackProgress(context.access);
  const manual = isManuallyCompletable(lesson.type);
  const completed = isStudent && (await isLessonCompleted(lesson.id, user.id));
  const videoProgress =
    lesson.type === "video" && isStudent ? await loadVideoProgress(lesson.id, user.id) : null;

  return (
    <article className={lesson.type === "scorm" ? "" : "max-w-3xl"}>
      <p>
        <Link href={`/courses/${context.course.id}`} className={linkClass}>
          {t("lesson.back")}
        </Link>
      </p>
      <p className="mt-4 text-sm text-neutral-700">{context.course.title}</p>
      <h1 className="text-2xl font-semibold">{lesson.title}</h1>

      <div className="mt-6">
        {lesson.type === "text" && <div className="whitespace-pre-wrap leading-relaxed">{lesson.content}</div>}
        {lesson.type === "file" &&
          (file ? (
            <p>
              {/* Plain <a>: this is a download served by a route handler, not a page. */}
              <a href={`/api/files/${file.id}`} className={linkClass}>
                {t("lesson.download", { name: file.originalName })}
              </a>{" "}
              <span className="text-sm text-neutral-700">
                (
                {format.number(Math.max(file.size / 1024 / 1024, 0.01), {
                  style: "unit",
                  unit: "megabyte",
                  maximumFractionDigits: 2,
                })}
                )
              </span>
            </p>
          ) : (
            <p className="text-neutral-700">{t("lesson.fileMissing")}</p>
          ))}
        {lesson.type === "scorm" &&
          (scorm ? (
            <>
              {!isStudent && <p className="mb-3 text-sm text-neutral-700">{t("lesson.scormPreview")}</p>}
              <ScormFrame
                launchUrl={createScormLaunchUrl(user.id, lesson.id, scorm)}
                scormOrigin={scormOrigin()}
                title={t("lesson.scormFrame", { title: lesson.title })}
              />
            </>
          ) : (
            <p className="text-neutral-700">{t("lesson.scormMissing")}</p>
          ))}
        {lesson.type === "video" &&
          (file ? (
            <>
              {!isStudent && <p className="mb-3 text-sm text-neutral-700">{t("lesson.videoPreview")}</p>}
              <VideoPlayer
                src={`/api/videos/${file.id}`}
                title={lesson.title}
                lessonId={lesson.id}
                track={isStudent}
                initialPosition={videoProgress?.position ?? 0}
                initialPercent={videoProgress?.percent ?? 0}
                initiallyCompleted={completed}
              />
            </>
          ) : (
            <p className="text-neutral-700">{t("lesson.fileMissing")}</p>
          ))}
      </div>

      {isStudent && (
        <div className="mt-8 border-t border-neutral-200 pt-6">
          {completed ? (
            <p role="status" className="font-semibold text-green-800">
              ✓ {t("lesson.completed")}
            </p>
          ) : manual ? (
            <ActionForm action={markLessonCompletedAction} submitLabel={t("lesson.markCompleted")}>
              <input type="hidden" name="lessonId" value={lesson.id} />
            </ActionForm>
          ) : (
            <p className="text-sm text-neutral-700">
              {t(lesson.type === "video" ? "lesson.videoPending" : "lesson.scormPending")}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
