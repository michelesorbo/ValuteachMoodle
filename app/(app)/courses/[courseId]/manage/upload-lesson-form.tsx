"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  createFileLessonAction,
  createScormLessonAction,
  createVideoLessonAction,
} from "@/modules/courses/actions";
import { buttonClasses, fieldClass, inputClass, labelClass } from "../../../ui";

const UPLOAD_ERRORS = [
  "tooLarge",
  "empty",
  "forbidden",
  "generic",
  "notMp4",
  "invalidZip",
  "unsafeZip",
  "zipTooLarge",
  "noManifest",
  "invalidManifest",
  "scorm2004",
] as const;
type UploadError = (typeof UPLOAD_ERRORS)[number];

type Status =
  | { kind: "idle" }
  | { kind: "uploading"; percent: number }
  | { kind: "processing" }
  | { kind: "success" }
  | { kind: "error"; message: string };

/**
 * "file": any file, downloaded by students.
 * "video": an MP4, streamed in the lesson player.
 * "scorm": a SCORM 1.2 zip, played in the SCORM player.
 */
type Kind = "file" | "video" | "scorm";

const KINDS = {
  file: { endpoint: "files", label: "file", hint: "fileHint", accept: undefined },
  video: { endpoint: "videos", label: "videoFile", hint: "videoHint", accept: "video/mp4,.mp4" },
  scorm: { endpoint: "scorm", label: "scormPackage", hint: "scormHint", accept: ".zip,application/zip" },
} as const;

type UploadResult = { ok: boolean; body: { fileId?: string; packageId?: string; error?: string } };

/** Sends the file as the raw request body. XMLHttpRequest, because fetch cannot report upload progress. */
function upload(url: string, file: File, onProgress: (percent: number) => void): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.setRequestHeader("content-type", file.type || "application/octet-stream");
    request.setRequestHeader("x-file-name", encodeURIComponent(file.name));
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.floor((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      let body: UploadResult["body"] = {};
      try {
        body = JSON.parse(request.responseText);
      } catch {
        // Not JSON: treated as a generic failure by the caller.
      }
      resolve({ ok: request.status >= 200 && request.status < 300, body });
    };
    request.onerror = () => reject(new Error("network error"));
    request.onabort = () => reject(new Error("aborted"));
    request.send(file);
  });
}

/**
 * Creates a lesson from an upload in two steps: the file is streamed to the upload
 * endpoint (raw body, so large files are never held in memory by the server),
 * then a server action attaches the stored file or package to a new lesson.
 */
export function UploadLessonForm({ courseId, kind, maxMb }: { courseId: string; kind: Kind; maxMb: number }) {
  const t = useTranslations("courses.manage");
  const tErrors = useTranslations("errors");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const config = KINDS[kind];

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "");
    const file = data.get("file");
    const uploadError = (code: UploadError) =>
      setStatus({ kind: "error", message: t(`uploadErrors.${code}`) });

    if (!(file instanceof File) || file.size === 0) return uploadError("empty");
    if (file.size > maxMb * 1024 * 1024) return uploadError("tooLarge");

    setStatus({ kind: "uploading", percent: 0 });
    try {
      const { ok, body } = await upload(`/api/courses/${courseId}/${config.endpoint}`, file, (percent) =>
        // At 100% the server is still checking the file (and extracting it, for SCORM).
        setStatus(percent >= 100 ? { kind: "processing" } : { kind: "uploading", percent }),
      );
      const uploadedId = kind === "scorm" ? body.packageId : body.fileId;
      if (!ok || !uploadedId) {
        return uploadError(UPLOAD_ERRORS.find((known) => known === body.error) ?? "generic");
      }

      const result =
        kind === "scorm"
          ? await createScormLessonAction({ courseId, title, packageId: uploadedId })
          : kind === "video"
            ? await createVideoLessonAction({ courseId, title, fileId: uploadedId })
            : await createFileLessonAction({ courseId, title, fileId: uploadedId });
      if (result.status === "error") {
        return setStatus({ kind: "error", message: tErrors(result.error) });
      }
      form.reset();
      setStatus({ kind: "success" });
    } catch {
      uploadError("generic");
    }
  }

  const pending = status.kind === "uploading" || status.kind === "processing";
  const id = `${kind}-lesson`;

  return (
    <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-4">
      <div className={fieldClass}>
        <label htmlFor={`${id}-title`} className={labelClass}>
          {t("lessonTitle")}
        </label>
        <input id={`${id}-title`} name="title" required maxLength={200} className={inputClass} />
      </div>
      <div className={fieldClass}>
        <label htmlFor={`${id}-file`} className={labelClass}>
          {t(config.label)}
        </label>
        <input
          id={`${id}-file`}
          name="file"
          type="file"
          required
          accept={config.accept}
          aria-describedby={`${id}-hint`}
          className={inputClass}
        />
        <p id={`${id}-hint`} className="text-sm text-neutral-700">
          {t(config.hint, { max: maxMb })}
        </p>
      </div>
      <p role="status" className="min-h-5 text-sm">
        {status.kind === "uploading" && t("uploadingPercent", { percent: status.percent })}
        {status.kind === "processing" && t("processing")}
        {status.kind === "success" && <span className="text-green-800">{t("added")}</span>}
        {status.kind === "error" && <span className="text-red-700">{status.message}</span>}
      </p>
      <button type="submit" disabled={pending} className={`self-start ${buttonClasses.primary}`}>
        {t("add")}
      </button>
    </form>
  );
}
