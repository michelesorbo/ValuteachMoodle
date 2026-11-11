"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type Props = {
  src: string;
  title: string;
  lessonId: string;
  /** False for teachers and admins: they watch without progress being recorded. */
  track: boolean;
  initialPosition: number;
  initialPercent: number;
  initiallyCompleted: boolean;
};

const REPORT_INTERVAL_MS = 10_000;

/**
 * Native video player (keyboard accessible controls) that reports the played time
 * ranges to the server, which decides when 90% of the video has been watched.
 */
export function VideoPlayer({
  src,
  title,
  lessonId,
  track,
  initialPosition,
  initialPercent,
  initiallyCompleted,
}: Props) {
  const t = useTranslations("courses.lesson");
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [percent, setPercent] = useState(initialPercent);
  // Values needed only when the player starts: later re-renders must not restart the effect.
  const start = useRef({ position: initialPosition, completed: initiallyCompleted });

  useEffect(() => {
    const element = video.current;
    if (!element) return;

    // Resume where the viewer stopped, unless they were at the very end.
    const resume = () => {
      const { position } = start.current;
      if (position > 0 && position < element.duration - 5) element.currentTime = position;
    };
    if (element.readyState >= 1) resume();
    else element.addEventListener("loadedmetadata", resume, { once: true });

    if (!track) return () => element.removeEventListener("loadedmetadata", resume);

    let completed = start.current.completed;
    let lastReport = 0;

    const report = async (closing: boolean) => {
      if (!Number.isFinite(element.duration) || element.duration <= 0 || element.played.length === 0) return;
      const ranges: [number, number][] = [];
      for (let index = 0; index < element.played.length; index += 1) {
        ranges.push([element.played.start(index), element.played.end(index)]);
      }
      lastReport = Date.now();
      try {
        const response = await fetch(`/api/lessons/${lessonId}/video-progress`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ranges, position: element.currentTime, duration: element.duration }),
          keepalive: closing,
        });
        if (response.status !== 200) return;
        const result: { percent: number; completed: boolean } = await response.json();
        setPercent(result.percent);
        if (result.completed && !completed) {
          completed = true;
          router.refresh();
        }
      } catch {
        // A failed report is retried by the next one: the ranges are cumulative.
      }
    };

    const onTimeUpdate = () => {
      if (Date.now() - lastReport >= REPORT_INTERVAL_MS) void report(false);
    };
    const onStop = () => void report(false);
    const onPageHide = () => void report(true);

    element.addEventListener("timeupdate", onTimeUpdate);
    element.addEventListener("pause", onStop);
    element.addEventListener("ended", onStop);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      element.removeEventListener("loadedmetadata", resume);
      element.removeEventListener("timeupdate", onTimeUpdate);
      element.removeEventListener("pause", onStop);
      element.removeEventListener("ended", onStop);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [lessonId, track, router]);

  return (
    <div>
      <video
        ref={video}
        src={src}
        title={title}
        controls
        playsInline
        preload="metadata"
        className="aspect-video w-full rounded bg-black"
      />
      {track && (
        <p role="status" className="mt-3 text-sm text-neutral-700">
          {t("videoWatched", { percent })}
        </p>
      )}
    </div>
  );
}
