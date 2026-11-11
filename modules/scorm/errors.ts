/** Reasons a SCORM package can be rejected. Each code has a message under "courses.manage.uploadErrors". */
export const SCORM_PACKAGE_ERRORS = [
  "invalidZip",
  "unsafeZip",
  "zipTooLarge",
  "noManifest",
  "invalidManifest",
  "scorm2004",
] as const;

export type ScormPackageErrorCode = (typeof SCORM_PACKAGE_ERRORS)[number];

export class ScormPackageError extends Error {
  constructor(
    readonly code: ScormPackageErrorCode,
    detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "ScormPackageError";
  }
}
