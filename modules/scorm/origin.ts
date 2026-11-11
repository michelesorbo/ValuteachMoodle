import { env } from "../config/env";

/**
 * The app and the SCORM player live on two different hosts served by the same server.
 * SCORM packages are third-party code: on their own origin they cannot read the app's
 * pages, storage or (HttpOnly, host-only) session cookie.
 *
 * The two hosts are still the same *site*, so the browser does attach the app's cookie
 * to requests that SCORM content sends to the app. Every state-changing endpoint of the
 * app must therefore check the request origin (server actions and Better Auth already do;
 * custom route handlers use `isAppOriginRequest`).
 */
export function appOrigin(): string {
  return new URL(env().BETTER_AUTH_URL).origin;
}

export function scormOrigin(): string {
  return new URL(env().SCORM_ORIGIN).origin;
}

export function isScormHost(request: Request): boolean {
  return request.headers.get("host")?.toLowerCase() === new URL(env().SCORM_ORIGIN).host;
}

/** True when a state-changing request was sent by a page of the app itself. */
export function isAppOriginRequest(request: Request): boolean {
  return request.headers.get("origin") === appOrigin();
}
