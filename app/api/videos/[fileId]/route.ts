import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getViewableCourse, isUuid } from "@/modules/courses/access";
import { serveFile } from "@/modules/files/serve";
import { resolveStoragePath } from "@/modules/files/storage";

const notFound = () => new Response(null, { status: 404 });

/**
 * Streams a course video (MP4, no transcoding) with range requests, so the browser
 * can seek without downloading the whole file. Only users enrolled in the course
 * (or admins) get it; everyone else receives 404.
 */
export async function GET(request: Request, context: RouteContext<"/api/videos/[fileId]">) {
  const { fileId } = await context.params;
  if (!isUuid(fileId)) return notFound();

  const [file] = await db.select().from(schema.courseFile).where(eq(schema.courseFile.id, fileId));
  if (!file || file.kind !== "video") return notFound();
  if (!(await getViewableCourse(file.courseId))) return notFound();

  return serveFile(request, resolveStoragePath(file.storageKey), {
    // Fixed type (checked at upload) rather than one derived from the stored file name.
    "Content-Type": "video/mp4",
    "Content-Disposition": "inline",
    "Cache-Control": "private, no-store",
  });
}
