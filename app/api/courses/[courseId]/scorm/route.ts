import { env } from "@/modules/config/env";
import { getManageableCourse } from "@/modules/courses/access";
import { sanitizeFileName, UploadTooLargeError } from "@/modules/files/storage";
import { ScormPackageError } from "@/modules/scorm/errors";
import { isAppOriginRequest } from "@/modules/scorm/origin";
import { importScormPackage } from "@/modules/scorm/package";

function error(code: string, status: number) {
  return Response.json({ error: code }, { status });
}

/**
 * Uploads a SCORM 1.2 package (zip) for a course. Only the course teachers and admins.
 * The body is the raw zip, streamed to disk; the package is then extracted with
 * zip-slip and zip-bomb protections and its manifest is validated.
 */
export async function POST(request: Request, context: RouteContext<"/api/courses/[courseId]/scorm">) {
  if (!isAppOriginRequest(request)) return error("forbidden", 403);
  const { courseId } = await context.params;
  const course = await getManageableCourse(courseId);
  if (!course) return error("forbidden", 403);

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > env().MAX_SCORM_UPLOAD_MB * 1024 * 1024) return error("tooLarge", 413);
  if (!request.body) return error("empty", 400);

  let originalName = "package.zip";
  try {
    originalName = sanitizeFileName(decodeURIComponent(request.headers.get("x-file-name") ?? ""));
  } catch {
    // Malformed encoding: keep the default name.
  }

  try {
    const imported = await importScormPackage({
      courseId: course.course.id,
      userId: course.user.id,
      body: request.body,
      originalName,
    });
    return Response.json(imported, { status: 201 });
  } catch (cause) {
    if (cause instanceof UploadTooLargeError) return error("tooLarge", 413);
    if (cause instanceof ScormPackageError) {
      console.warn("[scorm] package rejected:", cause.message);
      return error(cause.code, 422);
    }
    console.error("[scorm] import failed", cause);
    return error("generic", 500);
  }
}
