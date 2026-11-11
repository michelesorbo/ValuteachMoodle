import { handleCourseUpload } from "@/modules/files/upload";

/** Uploads a generic file for a course (limit: MAX_FILE_UPLOAD_MB). */
export async function POST(request: Request, context: RouteContext<"/api/courses/[courseId]/files">) {
  const { courseId } = await context.params;
  return handleCourseUpload(request, courseId, "file");
}
