"use client";

import { useEffect, useRef, useState } from "react";
import { Scorm12Api, type CommitPayload, type ScormInit } from "@/modules/scorm/api";

declare global {
  interface Window {
    /** SCORM 1.2 API adapter, looked up by the content in its parent windows. */
    API?: Scorm12Api;
  }
}

/** Message sent to the lesson page (the parent window) when the lesson becomes completed. */
export const SCORM_COMPLETED_MESSAGE = "newlms:scorm-completed";

type Props = {
  title: string;
  contentUrl: string;
  commitUrl: string;
  appOrigin: string;
  saveErrorMessage: string;
  init: ScormInit;
};

// Browsers cap the body of keepalive requests (used while the page is closing) at 64 KB.
const KEEPALIVE_LIMIT = 60_000;

export function ScormPlayer({ title, contentUrl, commitUrl, appOrigin, saveErrorMessage, init }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    // Saves are sent one at a time, in order, so an older snapshot never overwrites a newer one.
    let queue: Promise<void> = Promise.resolve();
    const send = (payload: CommitPayload, closing: boolean) => {
      const body = JSON.stringify(payload);
      queue = queue.then(async () => {
        try {
          const response = await fetch(commitUrl, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
            keepalive: closing && body.length < KEEPALIVE_LIMIT,
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          setSaveFailed(false);
          const result: { completed?: boolean } | null = await response.json().catch(() => null);
          if (result?.completed && window.parent !== window) {
            window.parent.postMessage({ type: SCORM_COMPLETED_MESSAGE }, appOrigin);
          }
        } catch {
          setSaveFailed(true);
        }
      });
    };

    const api = new Scorm12Api(init, { onCommit: (payload) => send(payload, payload.finished) });
    window.API = api;

    // The content is loaded only now, so the API always exists before its scripts look for it.
    const iframe = frame.current;
    if (iframe) iframe.src = contentUrl;

    // Content that is closed without LMSFinish still gets its latest data saved.
    const onPageHide = () => {
      const snapshot = api.snapshot();
      if (snapshot) send(snapshot, true);
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      if (iframe) iframe.removeAttribute("src");
      if (window.API === api) delete window.API;
    };
  }, [init, contentUrl, commitUrl, appOrigin]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {saveFailed && (
        <p role="alert" className="bg-red-50 px-4 py-2 text-sm text-red-800">
          {saveErrorMessage}
        </p>
      )}
      <iframe
        ref={frame}
        title={title}
        allow="fullscreen; autoplay"
        className="w-full flex-1 border-0"
      />
    </div>
  );
}
