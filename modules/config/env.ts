import { z } from "zod";

const baseSchema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  /** Origin of the separate subdomain that serves SCORM content and the player (never the app's own origin). */
  SCORM_ORIGIN: z.url(),
  /** Directory holding uploaded files, videos and extracted SCORM packages. Never served directly. */
  FILES_DIR: z.string().min(1).default("./data/files"),
  MAX_FILE_UPLOAD_MB: z.coerce.number().int().positive().default(100),
  MAX_SCORM_UPLOAD_MB: z.coerce.number().int().positive().default(500),
  /** Zip-bomb guard: maximum size of an extracted SCORM package. */
  MAX_SCORM_EXTRACTED_MB: z.coerce.number().int().positive().default(2000),
  MAX_VIDEO_UPLOAD_MB: z.coerce.number().int().positive().default(1024),
});

// SCORM content is untrusted code: it must never run in the app's own origin.
const schema = baseSchema.refine(
  (value) => new URL(value.SCORM_ORIGIN).host !== new URL(value.BETTER_AUTH_URL).host,
  { message: "SCORM_ORIGIN must be a different host from BETTER_AUTH_URL", path: ["SCORM_ORIGIN"] },
);

export type Env = z.infer<typeof schema>;

/** Parses environment variables; empty strings count as "not set" so defaults apply. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value !== ""),
  );
  return schema.parse(cleaned);
}

let cached: Env | undefined;

/** Lazy accessor: validation happens on first use, not at import time (so `next build` works without secrets). */
export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
