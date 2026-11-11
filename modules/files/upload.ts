import "server-only";
import { randomUUID } from "node:crypto";
import { open } from "node:fs/promises";
import { db, schema } from "@/db";
import { env } from "@/modules/config/env";
import { getManageableCourse } from "@/modules/courses/access";
import { looksLikeMp4 } from "@/modules/progress/video";
import { isAppOriginRequest } from "@/modules/scorm/origin";
import {
  courseFileKey,
  deleteStored,
  resolveStoragePath,
  sanitizeFileName,
  UploadTooLargeError,
  writeUpload,
} from "./storage";

/** "file": any file, offered as a download. "video": an MP4, streamed in the lesson player. */
export type UploadKind = "file" | "video";

function error(code: "forbidden" | "tooLarge" | "empty" | "notMp4" | "generic", status: number) {
  return Response.json({ error: code }, { status });
}

async function readHeader(storageKey: string, length: number): Promise<Uint8Array> {
  const handle = await open(resolveStoragePath(storageKey), "r");
  try {
    const buffer = new Uint8Array(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/**
 * Handles an upload for a course: only the course teachers and admins may upload.
 * The request body is the raw file, streamed to disk and never buffered in memory;
 * the original name travels URL-encoded in the `x-file-name` header.
 * Responds with `{ fileId }` or `{ error }`.
 */
export async function handleCourseUpload(request: Request, courseId: string, kind: UploadKind): Promise<Response> {
  // SCORM content runs on a sibling subdomain and could otherwise post here with the user's cookie.
  if (!isAppOriginRequest(request)) return error("forbidden", 403);
  const course = await getManageableCourse(courseId);
  if (!course) return error("forbidden", 403);

  const settings = env();
  const maxBytes = (kind === "video" ? settings.MAX_VIDEO_UPLOAD_MB : settings.MAX_FILE_UPLOAD_MB) * 1024 * 1024;
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return error("tooLarge", 413);
  if (!request.body) return error("empty", 400);

  let originalName = "file";
  try {
    originalName = sanitizeFileName(decodeURIComponent(request.headers.get("x-file-name") ?? ""));
  } catch {
    // Malformed encoding: keep the default name.
  }

  const fileId = randomUUID();
  const storageKey = courseFileKey(course.course.id, fileId);

  try {
    const size = await writeUpload(storageKey, request.body, maxBytes);
    if (size === 0) {
      await deleteStored(storageKey);
      return error("empty", 400);
    }
    // Videos are played in the browser, so check the content and not just the name.
    if (kind === "video" && !looksLikeMp4(await readHeader(storageKey, 12))) {
      await deleteStored(storageKey);
      return error("notMp4", 422);
    }

    await db.insert(schema.courseFile).values({
      id: fileId,
      courseId: course.course.id,
      kind,
      storageKey,
      originalName,
      mimeType:
        kind === "video"
          ? "video/mp4"
          : (request.headers.get("content-type") ?? "application/octet-stream").slice(0, 200),
      size,
      uploadedBy: course.user.id,
    });
  } catch (cause) {
    await deleteStored(storageKey);
    if (cause instanceof UploadTooLargeError) return error("tooLarge", 413);
    console.error("[files] upload failed", cause);
    return error("generic", 500);
  }

  return Response.json({ fileId }, { status: 201 });
}
