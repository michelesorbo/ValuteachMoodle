"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Keep in sync with SCORM_COMPLETED_MESSAGE in app/scorm/[token]/player/scorm-player.tsx.
const SCORM_COMPLETED_MESSAGE = "newlms:scorm-completed";

type Props = {
  /** Player URL on the SCORM origin, with the launch token. */
  launchUrl: string;
  scormOrigin: string;
  title: string;
};

/**
 * Embeds the SCORM player (a different origin) in the lesson page and refreshes the
 * page's data when the player reports that the lesson has been completed.
 */
export function ScormFrame({ launchUrl, scormOrigin, title }: Props) {
  const router = useRouter();
  // A refresh re-renders the page with a new token: keep the first URL, or the content would restart.
  const [stableUrl] = useState(launchUrl);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== scormOrigin) return;
      if ((event.data as { type?: unknown } | null)?.type === SCORM_COMPLETED_MESSAGE) router.refresh();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [router, scormOrigin]);

  return (
    <iframe
      src={stableUrl}
      title={title}
      allow="fullscreen; autoplay"
      className="h-[75vh] min-h-96 w-full rounded border border-neutral-300"
    />
  );
}
