import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed launch token for the SCORM origin.
 *
 * The SCORM subdomain never sees the app's session cookie, so the app hands the
 * player a token that proves "this user may run this lesson until `exp`".
 * The token travels in the URL path of the player and of every content file,
 * which keeps relative links inside the package working without cookies.
 * It is scoped to one user and one lesson, and it expires.
 */
export type ScormTokenPayload = {
  /** User id. */
  userId: string;
  lessonId: string;
  /** Storage key of the extracted package directory (trusted: it is signed). */
  packageKey: string;
  /** Random id of this launch; lets the server tell sessions apart when adding up time. */
  sessionId: string;
  /** Expiry, in seconds since the epoch. */
  exp: number;
};

/** Long enough for a long lesson; when it expires the learner reloads the page to get a new one. */
export const SCORM_TOKEN_TTL_SECONDS = 4 * 60 * 60;

const CONTEXT = "newlms:scorm-launch:v1";

function sign(body: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(`${CONTEXT}.${body}`).digest();
}

export function signScormToken(payload: ScormTokenPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, secret).toString("base64url")}`;
}

/** Returns the payload when the signature is valid and the token has not expired, otherwise null. */
export function verifyScormToken(
  token: string,
  secret: string,
  nowSeconds: number = Date.now() / 1000,
): ScormTokenPayload | null {
  const [body, signature, ...rest] = token.split(".");
  if (!body || !signature || rest.length > 0) return null;

  const expected = sign(body, secret);
  const received = Buffer.from(signature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ScormTokenPayload;
    if (
      typeof payload.userId !== "string" ||
      typeof payload.lessonId !== "string" ||
      typeof payload.packageKey !== "string" ||
      typeof payload.sessionId !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp <= nowSeconds
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
