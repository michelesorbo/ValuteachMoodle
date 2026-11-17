import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { listRolesWithScopes } from "@/modules/auth/access";
import { requireUser } from "@/modules/auth/session";
import { env } from "@/modules/config/env";
import { getManageableCourse } from "@/modules/courses/access";
import {
  deleteCourseAction,
  deleteLessonAction,
  enrollUserAction,
  moveLessonAction,
  removeEnrollmentAction,
  updateEnrollmentAction,
  createTextLessonAction,
  updateCourseAction,
} from "@/modules/courses/actions";
import {
  canDeleteCourse,
  canManageEnrollment,
  canTrackProgress,
  type CourseAccess,
} from "@/modules/courses/permissions";
import { listEnrollableUsers, listLessons, listMembers } from "@/modules/courses/queries";
import type { Course } from "@/db/schema";
import { ActionForm } from "../../../action-form";
import { ScopeChecklist } from "../../../scope-checklist";
import { PageFallback } from "../../../page-fallback";
import { buttonClasses, fieldClass, inputClass, labelClass, linkClass, sectionTitleClass } from "../../../ui";
import { UploadLessonForm } from "./upload-lesson-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("titles");
  return { title: t("manage") };
}

type Props = PageProps<"/courses/[courseId]/manage">;

export default function ManageCoursePage(props: Props) {
  return (
    <Suspense fallback={<PageFallback />}>
      <ManageCourse params={props.params} />
    </Suspense>
  );
}

async function ManageCourse({ params }: { params: Props["params"] }) {
  await requireUser();
  const { courseId } = await params;
  // Only the course teachers and admins; everyone else gets a 404.
  const context = await getManageableCourse(courseId);
  if (!context) notFound();

  const { course, access } = context;
  const t = await getTranslations("courses");

  return (
    <>
      <p>
        <Link href={`/courses/${course.id}`} className={linkClass}>
          {t("manage.back")}
        </Link>
      </p>
      <p className="mt-4 text-sm text-neutral-700">{t("manage.title")}</p>
      <h1 className="text-2xl font-semibold">{course.title}</h1>

      <CourseDetails course={course} access={access} />
      <Lessons course={course} />
      <Members course={course} access={access} />
    </>
  );
}

async function CourseDetails({ course, access }: { course: Course; access: CourseAccess }) {
  const t = await getTranslations("courses");

  return (
    <section aria-labelledby="dati-corso" className="mt-8 max-w-xl">
      <h2 id="dati-corso" className={sectionTitleClass}>
        {t("manage.details")}
      </h2>
      <ActionForm
        action={updateCourseAction}
        submitLabel={t("manage.save")}
        successMessage={t("manage.saved")}
        className="mt-4 flex flex-col gap-4"
      >
        <input type="hidden" name="courseId" value={course.id} />
        <div className={fieldClass}>
          <label htmlFor="course-title" className={labelClass}>
            {t("fields.title")}
          </label>
          <input
            id="course-title"
            name="title"
            required
            maxLength={200}
            defaultValue={course.title}
            className={inputClass}
          />
        </div>
        <div className={fieldClass}>
          <label htmlFor="course-description" className={labelClass}>
            {t("fields.description")}
          </label>
          <textarea
            id="course-description"
            name="description"
            rows={4}
            maxLength={5000}
            defaultValue={course.description}
            className={inputClass}
          />
        </div>
      </ActionForm>
      {canDeleteCourse(access) && (
        <div className="mt-4">
          <ActionForm
            action={deleteCourseAction}
            submitLabel={t("manage.delete")}
            confirmMessage={t("manage.deleteConfirm")}
            variant="danger"
            inline
          >
            <input type="hidden" name="courseId" value={course.id} />
          </ActionForm>
        </div>
      )}
    </section>
  );
}

async function Lessons({ course }: { course: Course }) {
  const t = await getTranslations("courses");
  const lessons = await listLessons(course.id);

  return (
    <section aria-labelledby="lezioni" className="mt-12">
      <h2 id="lezioni" className={sectionTitleClass}>
        {t("manage.lessons")}
      </h2>

      {lessons.length === 0 ? (
        <p className="mt-3 text-neutral-700">{t("manage.noLessons")}</p>
      ) : (
        <ol className="mt-3 divide-y divide-neutral-200 border-y border-neutral-200">
          {lessons.map((lesson, index) => (
            <li key={lesson.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <span className="w-6 text-neutral-700">{index + 1}.</span>
              <span className="font-medium">{lesson.title}</span>
              <span className="text-sm text-neutral-700">{t(`lessonTypes.${lesson.type}`)}</span>
              <div
                role="group"
                aria-label={t("manage.lessonActions", { title: lesson.title })}
                className="ml-auto flex flex-wrap items-center gap-2"
              >
                {index > 0 && (
                  <ActionForm action={moveLessonAction} submitLabel={t("manage.moveUp")} variant="secondary" inline>
                    <input type="hidden" name="lessonId" value={lesson.id} />
                    <input type="hidden" name="direction" value="up" />
                  </ActionForm>
                )}
                {index < lessons.length - 1 && (
                  <ActionForm action={moveLessonAction} submitLabel={t("manage.moveDown")} variant="secondary" inline>
                    <input type="hidden" name="lessonId" value={lesson.id} />
                    <input type="hidden" name="direction" value="down" />
                  </ActionForm>
                )}
                <Link
                  href={`/courses/${course.id}/manage/lessons/${lesson.id}`}
                  className={buttonClasses.secondary}
                >
                  {t("manage.edit")}
                </Link>
                <ActionForm
                  action={deleteLessonAction}
                  submitLabel={t("manage.deleteLesson")}
                  confirmMessage={t("manage.deleteLessonConfirm")}
                  variant="danger"
                  inline
                >
                  <input type="hidden" name="lessonId" value={lesson.id} />
                </ActionForm>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-8 grid gap-10 md:grid-cols-2">
        <div>
          <h3 className="text-lg font-semibold">{t("manage.addText")}</h3>
          <ActionForm
            action={createTextLessonAction}
            submitLabel={t("manage.add")}
            successMessage={t("manage.added")}
            className="mt-3 flex flex-col gap-4"
          >
            <input type="hidden" name="courseId" value={course.id} />
            <div className={fieldClass}>
              <label htmlFor="text-lesson-title" className={labelClass}>
                {t("manage.lessonTitle")}
              </label>
              <input id="text-lesson-title" name="title" required maxLength={200} className={inputClass} />
            </div>
            <div className={fieldClass}>
              <label htmlFor="text-lesson-content" className={labelClass}>
                {t("manage.content")}
              </label>
              <textarea
                id="text-lesson-content"
                name="content"
                required
                rows={8}
                maxLength={100000}
                className={inputClass}
              />
            </div>
          </ActionForm>
        </div>

        <div>
          <h3 className="text-lg font-semibold">{t("manage.addFile")}</h3>
          <UploadLessonForm courseId={course.id} kind="file" maxMb={env().MAX_FILE_UPLOAD_MB} />
        </div>

        <div>
          <h3 className="text-lg font-semibold">{t("manage.addVideo")}</h3>
          <UploadLessonForm courseId={course.id} kind="video" maxMb={env().MAX_VIDEO_UPLOAD_MB} />
        </div>

        <div>
          <h3 className="text-lg font-semibold">{t("manage.addScorm")}</h3>
          <UploadLessonForm courseId={course.id} kind="scorm" maxMb={env().MAX_SCORM_UPLOAD_MB} />
        </div>
      </div>
    </section>
  );
}

async function Members({ course, access }: { course: Course; access: CourseAccess }) {
  const t = await getTranslations("courses");
  const [members, lessons, candidates, roles] = await Promise.all([
    listMembers(course.id),
    listLessons(course.id),
    listEnrollableUsers(course.id),
    listRolesWithScopes("course"),
  ]);
  const canEnroll = access.scopes.has("course:enrollments:manage");
  // A role can be handed out only if all its scopes are within what the current user may grant.
  const assignableRoles = roles.filter((role) => canManageEnrollment(access, role.scopes));
  const scopesOfRole = new Map(roles.map((role) => [role.id, role.scopes]));
  const grantedTo = (member: (typeof members)[number]) => [
    ...(scopesOfRole.get(member.roleId) ?? []),
    ...member.extraScopes,
  ];

  return (
    <section aria-labelledby="iscritti" className="mt-12">
      <h2 id="iscritti" className={sectionTitleClass}>
        {t("manage.members")}
      </h2>

      {members.length === 0 ? (
        <p className="mt-3 text-neutral-700">{t("manage.noMembers")}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">{t("manage.membersCaption")}</caption>
            <thead>
              <tr className="border-b border-neutral-400">
                <th scope="col" className="py-2 pr-4 font-medium">{t("manage.name")}</th>
                <th scope="col" className="py-2 pr-4 font-medium">{t("manage.email")}</th>
                <th scope="col" className="py-2 pr-4 font-medium">{t("manage.role")}</th>
                <th scope="col" className="py-2 pr-4 font-medium">{t("manage.progress")}</th>
                <th scope="col" className="py-2 font-medium">{t("manage.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.enrollmentId} className="border-b border-neutral-200">
                  <th scope="row" className="py-2 pr-4 font-normal">{member.name}</th>
                  <td className="py-2 pr-4">{member.email}</td>
                  <td className="py-2 pr-4">{member.roleName}</td>
                  <td className="py-2 pr-4">
                    {canTrackProgress({ scopes: new Set(grantedTo(member)) })
                      ? t("progress.summary", { completed: member.completed, total: lessons.length })
                      : "—"}
                  </td>
                  <td className="py-2">
                    {canManageEnrollment(access, grantedTo(member)) && (
                      <div className="flex flex-col gap-2">
                        <ActionForm
                          action={removeEnrollmentAction}
                          submitLabel={t("manage.remove")}
                          confirmMessage={t("manage.removeConfirm", { name: member.name })}
                          variant="danger"
                          inline
                        >
                          <input type="hidden" name="enrollmentId" value={member.enrollmentId} />
                        </ActionForm>
                        <details>
                          <summary className="cursor-pointer">
                            {t("manage.editEnrollment")}
                            <span className="sr-only"> {member.name}</span>
                          </summary>
                          <ActionForm
                            action={updateEnrollmentAction}
                            submitLabel={t("manage.save")}
                            successMessage={t("manage.saved")}
                            className="mt-2 flex max-w-md flex-col gap-3"
                          >
                            <input type="hidden" name="enrollmentId" value={member.enrollmentId} />
                            <div className={fieldClass}>
                              <label htmlFor={`role-${member.enrollmentId}`} className={labelClass}>
                                {t("manage.memberRole")}
                              </label>
                              <select
                                id={`role-${member.enrollmentId}`}
                                name="roleId"
                                defaultValue={member.roleId}
                                className={inputClass}
                              >
                                {roles
                                  .filter((role) => role.id === member.roleId || assignableRoles.includes(role))
                                  .map((role) => (
                                    <option key={role.id} value={role.id}>
                                      {role.name}
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <div>
                              <p className={labelClass}>{t("manage.extraScopes")}</p>
                              <p className="mb-2 text-sm text-neutral-700">{t("manage.extraScopesHint")}</p>
                              <ScopeChecklist
                                groups={["course"]}
                                selected={member.extraScopes}
                                lockedUnless={access.scopes}
                                idPrefix={`member-${member.enrollmentId}`}
                              />
                            </div>
                          </ActionForm>
                        </details>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEnroll && <h3 className="mt-8 text-lg font-semibold">{t("manage.enroll")}</h3>}
      {!canEnroll ? null : candidates.length === 0 ? (
        <p className="mt-3 text-neutral-700">{t("manage.noUsers")}</p>
      ) : (
        <ActionForm
          action={enrollUserAction}
          submitLabel={t("manage.enrollSubmit")}
          successMessage={t("manage.enrolled")}
          className="mt-3 flex max-w-xl flex-col gap-4"
        >
          <input type="hidden" name="courseId" value={course.id} />
          <div className={fieldClass}>
            <label htmlFor="enroll-user" className={labelClass}>
              {t("manage.user")}
            </label>
            <select id="enroll-user" name="userId" required className={inputClass}>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} ({candidate.email})
                </option>
              ))}
            </select>
          </div>
          <div className={fieldClass}>
            <label htmlFor="enroll-role" className={labelClass}>
              {t("manage.role")}
            </label>
            <select id="enroll-role" name="roleId" required className={inputClass}>
              {assignableRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
        </ActionForm>
      )}
    </section>
  );
}
