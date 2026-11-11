import { NextResponse, type NextRequest } from "next/server";

/**
 * Keeps the app and the SCORM player on their own hosts (both are served by this server):
 * - on the SCORM host only /scorm/* exists, so no app page, API or sign-in runs there;
 * - on the app host /scorm/* does not exist, so SCORM content never runs in the app's origin.
 * It also sets who may embed each of them in a frame.
 */
function hostOf(url: string | undefined): string | null {
  try {
    return url ? new URL(url).host : null;
  } catch {
    return null;
  }
}

function originOf(url: string | undefined): string {
  try {
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
}

const notFound = () => new NextResponse(null, { status: 404 });

export function proxy(request: NextRequest) {
  const scormHost = hostOf(process.env.SCORM_ORIGIN);
  const host = request.headers.get("host")?.toLowerCase() ?? "";
  const { pathname } = request.nextUrl;
  const isScormPath = pathname === "/scorm" || pathname.startsWith("/scorm/");

  if (scormHost !== null && host === scormHost) {
    if (!isScormPath) return notFound();
    const response = NextResponse.next();
    // The player is framed by the app, and the content by the player.
    response.headers.set(
      "Content-Security-Policy",
      `frame-ancestors 'self' ${originOf(process.env.BETTER_AUTH_URL)}`.trim(),
    );
    // The launch token is part of the URL: never send it to other sites.
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }

  if (isScormPath) return notFound();
  const response = NextResponse.next();
  // App pages may only be framed by the app itself (not by SCORM content or other sites).
  response.headers.set("Content-Security-Policy", "frame-ancestors 'self'");
  return response;
}

export const config = {
  matcher: [
    // Everything except Next.js internals and the upload endpoints: requests that go
    // through the proxy have their body buffered in memory (10 MB limit), which large
    // uploads must avoid. Upload endpoints need the app session, which the SCORM host never has.
    "/((?!_next/|api/courses/).*)",
  ],
};
