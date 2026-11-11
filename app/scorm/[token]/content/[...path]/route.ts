import path from "node:path";
import { serveFile } from "@/modules/files/serve";
import { resolveStoragePath } from "@/modules/files/storage";
import { isScormHost } from "@/modules/scorm/origin";
import { readScormToken } from "@/modules/scorm/session";

/**
 * Serves one file of an extracted SCORM package, on the SCORM host only.
 * Access is granted by the signed, expiring launch token in the URL, which the app
 * issues only to users who may view the course. The token is verified on every
 * request; the database is not queried here because a package loads hundreds of files.
 */
export async function GET(request: Request, context: RouteContext<"/scorm/[token]/content/[...path]">) {
  if (!isScormHost(request)) return new Response(null, { status: 404 });

  const { token, path: segments } = await context.params;
  const payload = readScormToken(token);
  if (!payload) return new Response(null, { status: 403 });

  // The requested path must stay inside this package's directory.
  const packageRoot = resolveStoragePath(payload.packageKey);
  const target = path.resolve(packageRoot, ...segments);
  if (segments.some((segment) => segment.includes("\0")) || !target.startsWith(packageRoot + path.sep)) {
    return new Response(null, { status: 404 });
  }

  return serveFile(request, target, { "Cache-Control": "private, max-age=600" });
}
