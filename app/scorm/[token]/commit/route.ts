import { isScormHost, scormOrigin } from "@/modules/scorm/origin";
import { loadScormSession, saveCommit } from "@/modules/scorm/session";
import { commitSchema } from "@/modules/scorm/tracking";

const MAX_BODY_BYTES = 2 * 1024 * 1024;

/**
 * Receives the tracking data the SCORM API saves (LMSCommit / LMSFinish): status, score,
 * session time and resume data. Called by the player, on the SCORM host, with the launch
 * token in the URL; the enrollment is re-checked in the database on every call.
 */
export async function POST(request: Request, context: RouteContext<"/scorm/[token]/commit">) {
  if (!isScormHost(request)) return new Response(null, { status: 404 });
  if (request.headers.get("origin") !== scormOrigin()) return new Response(null, { status: 403 });

  const { token } = await context.params;
  const session = await loadScormSession(token);
  if (!session) return Response.json({ error: "expired" }, { status: 403 });

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return Response.json({ error: "tooLarge" }, { status: 413 });
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return Response.json({ error: "tooLarge" }, { status: 413 });

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const commit = commitSchema.safeParse(json);
  if (!commit.success) return Response.json({ error: "invalid" }, { status: 400 });

  const { completed } = await saveCommit(session, commit.data);
  return Response.json({ ok: true, completed });
}
