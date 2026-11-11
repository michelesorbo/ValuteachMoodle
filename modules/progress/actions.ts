"use server";

import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireUser } from "@/modules/auth/session";
import { getViewableCourse } from "@/modules/courses/access";
import { canTrackProgress } from "@/modules/courses/permissions";
import { getLesson } from "@/modules/courses/queries";
import { failure, success, type FormState } from "@/modules/shared/form-state";
import { isManuallyCompletable } from "./progress";

/** "Mark as completed" for text and file lessons. Only students of the course have progress. */
export async function markLessonCompletedAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const found = await getLesson(String(formData.get("lessonId")));
  if (!found) return failure("notFound");
  const context = await getViewableCourse(found.lesson.courseId);
  if (!context) return failure("notFound");
  if (!canTrackProgress(context.access) || !isManuallyCompletable(found.lesson.type)) {
    return failure("forbidden");
  }

  await db
    .insert(schema.lessonProgress)
    .values({ lessonId: found.lesson.id, userId: user.id })
    .onConflictDoNothing();
  revalidatePath("/", "layout");
  return success;
}
