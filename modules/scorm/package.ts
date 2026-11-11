import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { db, schema } from "@/db";
import { env } from "@/modules/config/env";
import { courseDirKey, deleteStored, resolveStoragePath, writeUpload } from "@/modules/files/storage";
import { ScormPackageError } from "./errors";
import { extractZip } from "./extract";
import { parseManifest } from "./manifest";

const MB = 1024 * 1024;
const MAX_ENTRIES = 50_000;
const MAX_MANIFEST_BYTES = 5 * MB;
const MANIFEST = "imsmanifest.xml";

async function isFile(key: string): Promise<boolean> {
  const info = await stat(resolveStoragePath(key)).catch(() => null);
  return info?.isFile() ?? false;
}

/**
 * The manifest must be at the root of the package; packages zipped together with
 * their containing folder (a common mistake) are accepted too.
 */
async function findPackageRoot(extractedKey: string): Promise<string> {
  if (await isFile(path.posix.join(extractedKey, MANIFEST))) return extractedKey;

  const entries = await readdir(resolveStoragePath(extractedKey), { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory());
  if (entries.length === 1 && directories.length === 1) {
    const nested = path.posix.join(extractedKey, directories[0].name);
    if (await isFile(path.posix.join(nested, MANIFEST))) return nested;
  }
  throw new ScormPackageError("noManifest");
}

/**
 * Stores an uploaded SCORM 1.2 zip: streams it to a temporary file, extracts it safely,
 * reads the manifest and records the package. Nothing is left on disk when it fails.
 * Throws UploadTooLargeError or ScormPackageError.
 */
export async function importScormPackage(input: {
  courseId: string;
  userId: string;
  body: ReadableStream<Uint8Array>;
  originalName: string;
}): Promise<{ packageId: string; title: string }> {
  const settings = env();
  const packageId = randomUUID();
  const zipKey = path.posix.join("tmp", `${packageId}.zip`);
  const extractedKey = path.posix.join(courseDirKey(input.courseId), "scorm", packageId);

  try {
    const size = await writeUpload(zipKey, input.body, settings.MAX_SCORM_UPLOAD_MB * MB);
    if (size === 0) throw new ScormPackageError("invalidZip", "empty upload");

    const extractedPath = resolveStoragePath(extractedKey);
    await mkdir(path.dirname(extractedPath), { recursive: true });
    await extractZip(resolveStoragePath(zipKey), extractedPath, {
      maxEntries: MAX_ENTRIES,
      maxTotalBytes: settings.MAX_SCORM_EXTRACTED_MB * MB,
    });

    try {
      const storageKey = await findPackageRoot(extractedKey);
      const manifestPath = resolveStoragePath(path.posix.join(storageKey, MANIFEST));
      if ((await stat(manifestPath)).size > MAX_MANIFEST_BYTES) {
        throw new ScormPackageError("invalidManifest", "manifest too large");
      }
      const manifest = parseManifest(await readFile(manifestPath, "utf8"));
      if (!(await isFile(path.posix.join(storageKey, manifest.launchPath)))) {
        throw new ScormPackageError("invalidManifest", "launch file not found in the package");
      }

      await db.insert(schema.scormPackage).values({
        id: packageId,
        courseId: input.courseId,
        extractedKey,
        storageKey,
        title: manifest.title.slice(0, 200),
        launchPath: manifest.launchPath,
        launchQuery: manifest.launchQuery,
        masteryScore: manifest.masteryScore,
        originalName: input.originalName,
        size,
        uploadedBy: input.userId,
      });
      return { packageId, title: manifest.title };
    } catch (error) {
      await deleteStored(extractedKey);
      throw error;
    }
  } finally {
    await deleteStored(zipKey);
  }
}
