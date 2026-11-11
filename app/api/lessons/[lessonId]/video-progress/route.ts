import { getCurrentUser } from "@/modules/auth/session";
import { getViewableCourse } from "@/modules/courses/access";
import { canTrackProgress } from "@/modules/courses/permissions";
import { getLesson } from "@/modules/courses/queries";
import { saveVideoProgress, videoReportSchema } from "@/modules/progress/video-store";
import { isAppOriginRequest } from "@/modules/scorm/origin";

/**
 * Receives what the video player has played so far and answers with the updated
 * percentage. A route handler rather than a server action because the last report
 * is sent while the page is closing (fetch with keepalive).
 */
export async function POST(request: Request, context: RouteContext<"/api/lessons/[lessonId]/video-progress">) {
  if (!isAppOriginRequest(request)) return new Response(null, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });

  const { lessonId } = await context.params;
  const found = await getLesson(lessonId);
  if (!found || found.lesson.type !== "video") return new Response(null, { status: 404 });
  const course = await getViewableCourse(found.lesson.courseId);
  if (!course) return new Response(null, { status: 404 });
  // Only students have progress: teachers and admins just watch.
  if (!canTrackProgress(course.access)) return new Response(null, { status: 204 });

  const report = videoReportSchema.safeParse(await request.json().catch(() => null));
  if (!report.success) return Response.json({ error: "invalid" }, { status: 400 });

  return Response.json(await saveVideoProgress(found.lesson.id, user.id, report.data));
}
