"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, isNull, max } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireAdmin, requireUser } from "@/modules/auth/session";
import { courseDirKey, deleteStored } from "@/modules/files/storage";
import { failure, success, type FormState } from "@/modules/shared/form-state";
import { getCourseContext, getManageableCourse } from "./access";
import { canDeleteCourse, canManageEnrollment, COURSE_ROLES } from "./permissions";
import { getLesson } from "./queries";

const { course, courseFile, enrollment, lesson, scormPackage } = schema;

const title = z.string().trim().min(1).max(200);
const courseFields = z.object({ title, description: z.string().trim().max(5000) });
const textLessonFields = z.object({ title, content: z.string().trim().min(1).max(100_000) });

/** Every mutation can change what several pages show (lists, progress), so refresh them all. */
function refresh() {
  revalidatePath("/", "layout");
}

async function nextPosition(courseId: string): Promise<number> {
  const [row] = await db
    .select({ last: max(lesson.position) })
    .from(lesson)
    .where(eq(lesson.courseId, courseId));
  return (row?.last ?? 0) + 1;
}

// --- courses ---

/** Admin only. */
export async function createCourseAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = courseFields.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("invalid");

  const [created] = await db
    .insert(course)
    .values({ ...parsed.data, createdBy: admin.id })
    .returning({ id: course.id });
  refresh();
  redirect(`/courses/${created.id}/manage`);
}

export async function updateCourseAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const context = await getManageableCourse(String(formData.get("courseId")));
  if (!context) return failure("forbidden");
  const parsed = courseFields.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("invalid");

  await db.update(course).set(parsed.data).where(eq(course.id, context.course.id));
  refresh();
  return success;
}

/** Admin only. Removes the course, its lessons, enrollments, progress and stored files. */
export async function deleteCourseAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const context = await getCourseContext(String(formData.get("courseId")));
  if (!context || !canDeleteCourse(context.access)) return failure("forbidden");

  await db.delete(course).where(eq(course.id, context.course.id));
  await deleteStored(courseDirKey(context.course.id));
  refresh();
  redirect("/");
}

// --- lessons ---

export async function createTextLessonAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const context = await getManageableCourse(String(formData.get("courseId")));
  if (!context) return failure("forbidden");
  const parsed = textLessonFields.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("invalid");

  await db.insert(lesson).values({
    courseId: context.course.id,
    type: "text",
    title: parsed.data.title,
    content: parsed.data.content,
    position: await nextPosition(context.course.id),
  });
  refresh();
  return success;
}

/**
 * Second step of a file or video lesson: the upload already went to
 * /api/courses/[courseId]/files or /videos, and is now attached to a new lesson.
 */
async function createUploadedLesson(
  input: { courseId: string; title: string; fileId: string },
  kind: "file" | "video",
): Promise<FormState> {
  await requireUser();
  const context = await getManageableCourse(input.courseId);
  if (!context) return failure("forbidden");
  const parsed = z.object({ title, fileId: z.uuid() }).safeParse(input);
  if (!parsed.success) return failure("invalid");

  // The upload must be of the right kind, belong to this course and not be attached to another lesson.
  const [file] = await db
    .select({ id: courseFile.id })
    .from(courseFile)
    .leftJoin(lesson, eq(lesson.fileId, courseFile.id))
    .where(
      and(
        eq(courseFile.id, parsed.data.fileId),
        eq(courseFile.courseId, context.course.id),
        eq(courseFile.kind, kind),
        isNull(lesson.id),
      ),
    );
  if (!file) return failure("invalid");

  await db.insert(lesson).values({
    courseId: context.course.id,
    type: kind,
    title: parsed.data.title,
    fileId: file.id,
    position: await nextPosition(context.course.id),
  });
  refresh();
  return success;
}

export async function createFileLessonAction(input: {
  courseId: string;
  title: string;
  fileId: string;
}): Promise<FormState> {
  return createUploadedLesson(input, "file");
}

export async function createVideoLessonAction(input: {
  courseId: string;
  title: string;
  fileId: string;
}): Promise<FormState> {
  return createUploadedLesson(input, "video");
}

/** Second step of a SCORM lesson: the package was already uploaded to /api/courses/[courseId]/scorm. */
export async function createScormLessonAction(input: {
  courseId: string;
  title: string;
  packageId: string;
}): Promise<FormState> {
  await requireUser();
  const context = await getManageableCourse(input.courseId);
  if (!context) return failure("forbidden");
  const parsed = z.object({ title, packageId: z.uuid() }).safeParse(input);
  if (!parsed.success) return failure("invalid");

  // The package must belong to this course and not be attached to another lesson.
  const [found] = await db
    .select({ id: scormPackage.id })
    .from(scormPackage)
    .leftJoin(lesson, eq(lesson.scormPackageId, scormPackage.id))
    .where(
      and(
        eq(scormPackage.id, parsed.data.packageId),
        eq(scormPackage.courseId, context.course.id),
        isNull(lesson.id),
      ),
    );
  if (!found) return failure("invalid");

  await db.insert(lesson).values({
    courseId: context.course.id,
    type: "scorm",
    title: parsed.data.title,
    scormPackageId: found.id,
    position: await nextPosition(context.course.id),
  });
  refresh();
  return success;
}

export async function updateLessonAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const found = await getLesson(String(formData.get("lessonId")));
  if (!found) return failure("notFound");
  const context = await getManageableCourse(found.lesson.courseId);
  if (!context) return failure("forbidden");

  const fields = Object.fromEntries(formData);
  if (found.lesson.type === "text") {
    const parsed = textLessonFields.safeParse(fields);
    if (!parsed.success) return failure("invalid");
    await db.update(lesson).set(parsed.data).where(eq(lesson.id, found.lesson.id));
  } else {
    const parsed = z.object({ title }).safeParse(fields);
    if (!parsed.success) return failure("invalid");
    await db.update(lesson).set(parsed.data).where(eq(lesson.id, found.lesson.id));
  }
  refresh();
  return success;
}

export async function deleteLessonAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const found = await getLesson(String(formData.get("lessonId")));
  if (!found) return failure("notFound");
  const context = await getManageableCourse(found.lesson.courseId);
  if (!context) return failure("forbidden");

  if (found.file) {
    // Deleting the file row removes the lesson too (cascade); then free the disk space.
    await db.delete(courseFile).where(eq(courseFile.id, found.file.id));
    await deleteStored(found.file.storageKey);
  } else if (found.scorm) {
    // Same for a SCORM package: the row cascades to the lesson and its attempts.
    await db.delete(scormPackage).where(eq(scormPackage.id, found.scorm.id));
    await deleteStored(found.scorm.extractedKey);
  } else {
    await db.delete(lesson).where(eq(lesson.id, found.lesson.id));
  }
  refresh();
  return success;
}

/** Moves a lesson one step up or down by swapping positions with its neighbour. */
export async function moveLessonAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const direction = z.enum(["up", "down"]).safeParse(formData.get("direction"));
  const found = await getLesson(String(formData.get("lessonId")));
  if (!found || !direction.success) return failure("notFound");
  const context = await getManageableCourse(found.lesson.courseId);
  if (!context) return failure("forbidden");

  await db.transaction(async (tx) => {
    const ordered = await tx
      .select({ id: lesson.id })
      .from(lesson)
      .where(eq(lesson.courseId, context.course.id))
      .orderBy(asc(lesson.position), asc(lesson.createdAt));
    const index = ordered.findIndex((row) => row.id === found.lesson.id);
    const target = direction.data === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= ordered.length) return;

    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    // Renumber the whole course so positions stay unique and gap-free.
    for (const [position, row] of ordered.entries()) {
      await tx.update(lesson).set({ position: position + 1 }).where(eq(lesson.id, row.id));
    }
  });
  refresh();
  return success;
}

// --- enrollments ---

/** Teachers enroll students; only admins assign teachers. */
export async function enrollUserAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const context = await getManageableCourse(String(formData.get("courseId")));
  if (!context) return failure("forbidden");
  const parsed = z
    .object({ userId: z.string().min(1).max(100), role: z.enum(COURSE_ROLES) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("invalid");
  if (!canManageEnrollment(context.access, parsed.data.role)) return failure("forbidden");

  const [target] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.id, parsed.data.userId));
  if (!target) return failure("invalid");

  const inserted = await db
    .insert(enrollment)
    .values({ courseId: context.course.id, userId: target.id, role: parsed.data.role })
    .onConflictDoNothing()
    .returning({ id: enrollment.id });
  if (inserted.length === 0) return failure("alreadyEnrolled");

  refresh();
  return success;
}

/** Teachers remove students; only admins remove teachers. Progress already recorded is kept. */
export async function removeEnrollmentAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const enrollmentId = z.uuid().safeParse(formData.get("enrollmentId"));
  if (!enrollmentId.success) return failure("notFound");

  const [target] = await db.select().from(enrollment).where(eq(enrollment.id, enrollmentId.data));
  if (!target) return failure("notFound");
  const context = await getManageableCourse(target.courseId);
  if (!context || !canManageEnrollment(context.access, target.role)) return failure("forbidden");

  await db.delete(enrollment).where(eq(enrollment.id, target.id));
  refresh();
  return success;
}
