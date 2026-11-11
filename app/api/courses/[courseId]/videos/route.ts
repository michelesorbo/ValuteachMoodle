import { handleCourseUpload } from "@/modules/files/upload";

/** Uploads an MP4 video for a course (limit: MAX_VIDEO_UPLOAD_MB). */
export async function POST(request: Request, context: RouteContext<"/api/courses/[courseId]/videos">) {
  const { courseId } = await context.params;
  return handleCourseUpload(request, courseId, "video");
}
