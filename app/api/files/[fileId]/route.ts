import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getViewableCourse, isUuid } from "@/modules/courses/access";
import { openStored } from "@/modules/files/storage";

const notFound = () => new Response(null, { status: 404 });

/**
 * Downloads a course file. Only users enrolled in the course (or admins) get it;
 * everyone else receives 404 so the existence of the file is not revealed.
 * Always sent as an attachment with a generic content type, so uploaded HTML or
 * scripts never run in the app's origin.
 */
export async function GET(_request: Request, context: RouteContext<"/api/files/[fileId]">) {
  const { fileId } = await context.params;
  if (!isUuid(fileId)) return notFound();

  const [file] = await db.select().from(schema.courseFile).where(eq(schema.courseFile.id, fileId));
  if (!file) return notFound();
  if (!(await getViewableCourse(file.courseId))) return notFound();

  const stored = await openStored(file.storageKey);
  if (!stored) return notFound();

  return new Response(stored.stream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(stored.size),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
