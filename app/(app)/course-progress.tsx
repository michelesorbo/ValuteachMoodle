import { getTranslations } from "next-intl/server";
import type { CourseProgress } from "@/modules/progress/progress";

/** Progress bar with a text summary (the text carries the information for screen readers). */
export async function CourseProgressBar({ progress }: { progress: CourseProgress }) {
  const t = await getTranslations("courses.progress");

  if (progress.total === 0) {
    return <p className="text-sm text-neutral-700">{t("noLessons")}</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      <progress
        aria-label={t("label")}
        value={progress.completed}
        max={progress.total}
        className="h-2 w-full max-w-xs accent-blue-700"
      />
      <p className="text-sm text-neutral-700">
        {t("summary", { completed: progress.completed, total: progress.total })}
        {progress.isCompleted && (
          <strong className="ml-2 font-semibold text-green-800">{t("courseCompleted")}</strong>
        )}
      </p>
    </div>
  );
}
