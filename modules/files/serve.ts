import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

/** Content types for files served inline (SCORM content, and video in a later phase). */
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".xsd": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".vtt": "text/vtt; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".ogv": "video/ogg",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
  ".pdf": "application/pdf",
  ".swf": "application/x-shockwave-flash",
  ".wasm": "application/wasm",
};

export function contentTypeFor(fileName: string): string {
  return MIME_TYPES[path.extname(fileName).toLowerCase()] ?? "application/octet-stream";
}

export type ByteRange = { start: number; end: number };

/**
 * Parses a single-range `Range` header for a file of `size` bytes.
 * Returns null when there is no usable range (serve the whole file) and
 * "unsatisfiable" when the range lies outside the file (answer 416).
 */
export function parseRange(header: string | null, size: number): ByteRange | null | "unsatisfiable" {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  // Malformed or multi-range requests are answered with the full file.
  if (!match || (match[1] === "" && match[2] === "")) return null;

  if (match[1] === "") {
    // Suffix range: the last N bytes.
    const length = Number(match[2]);
    if (length === 0 || size === 0) return "unsatisfiable";
    return { start: Math.max(0, size - length), end: size - 1 };
  }

  const start = Number(match[1]);
  const end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  if (start >= size || start > end) return "unsatisfiable";
  return { start, end };
}

/**
 * Streams a file from disk, honouring range requests (needed to seek in audio and video).
 * The caller is responsible for authorization and for making sure `absolutePath` is safe.
 */
export async function serveFile(
  request: Request,
  absolutePath: string,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const info = await stat(absolutePath).catch(() => null);
  if (!info?.isFile()) return new Response(null, { status: 404, headers: extraHeaders });

  const headers = new Headers({
    "Content-Type": contentTypeFor(absolutePath),
    "Accept-Ranges": "bytes",
    "Last-Modified": info.mtime.toUTCString(),
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  });

  const range = parseRange(request.headers.get("range"), info.size);
  if (range === "unsatisfiable") {
    headers.set("Content-Range", `bytes */${info.size}`);
    return new Response(null, { status: 416, headers });
  }

  const start = range?.start ?? 0;
  const end = range?.end ?? info.size - 1;
  headers.set("Content-Length", String(info.size === 0 ? 0 : end - start + 1));
  if (range) headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);

  if (request.method === "HEAD" || info.size === 0) {
    return new Response(null, { status: range ? 206 : 200, headers });
  }
  const stream = Readable.toWeb(createReadStream(absolutePath, { start, end }));
  return new Response(stream as unknown as ReadableStream<Uint8Array>, {
    status: range ? 206 : 200,
    headers,
  });
}
