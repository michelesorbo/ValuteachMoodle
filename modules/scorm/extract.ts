import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import yauzl, { type Entry, type ZipFile } from "yauzl";
import { ScormPackageError } from "./errors";

export type ExtractLimits = {
  /** Maximum number of entries in the archive. */
  maxEntries: number;
  /** Maximum total size of the extracted files, in bytes. */
  maxTotalBytes: number;
};

export type ExtractResult = { files: number; bytes: number };

const S_IFMT = 0o170000;
const S_IFLNK = 0o120000;

/**
 * Extracts a zip archive into `destDir` (which must not exist yet), defending against:
 * - zip-slip: absolute paths, "..", backslashes and symlinks are refused, and every
 *   target path is checked to be inside `destDir`;
 * - zip bombs: the entry count, the declared sizes and the bytes actually written
 *   are all capped (yauzl also fails when an entry inflates beyond its declared size).
 * On any failure the partially extracted directory is removed.
 */
export async function extractZip(
  zipPath: string,
  destDir: string,
  limits: ExtractLimits,
): Promise<ExtractResult> {
  const root = path.resolve(destDir);
  await mkdir(root, { recursive: false });
  try {
    return await extractInto(zipPath, root, limits);
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    if (error instanceof ScormPackageError) throw error;
    throw new ScormPackageError("invalidZip", error instanceof Error ? error.message : undefined);
  }
}

function openZip(zipPath: string): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    // strictFileNames: reject backslashes instead of silently converting them.
    yauzl.open(zipPath, { lazyEntries: true, strictFileNames: true }, (error, zip) =>
      error ? reject(error) : resolve(zip),
    );
  });
}

function openEntry(zip: ZipFile, entry: Entry): Promise<NodeJS.ReadableStream> {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => (error ? reject(error) : resolve(stream)));
  });
}

async function extractInto(zipPath: string, root: string, limits: ExtractLimits): Promise<ExtractResult> {
  const zip = await openZip(zipPath);
  let entries = 0;
  let files = 0;
  let declaredBytes = 0;
  let writtenBytes = 0;

  async function handle(entry: Entry): Promise<void> {
    entries += 1;
    if (entries > limits.maxEntries) throw new ScormPackageError("zipTooLarge", "too many entries");

    const name = entry.fileName;
    // macOS resource forks: harmless, but useless.
    if (name.startsWith("__MACOSX/")) return;

    const target = path.resolve(root, name);
    if (name.includes("\0") || !target.startsWith(root + path.sep)) {
      throw new ScormPackageError("unsafeZip", name);
    }
    if (((entry.externalFileAttributes >>> 16) & S_IFMT) === S_IFLNK) {
      throw new ScormPackageError("unsafeZip", `symlink: ${name}`);
    }

    if (name.endsWith("/")) {
      await mkdir(target, { recursive: true });
      return;
    }

    declaredBytes += entry.uncompressedSize;
    if (declaredBytes > limits.maxTotalBytes) throw new ScormPackageError("zipTooLarge");

    await mkdir(path.dirname(target), { recursive: true });
    const counter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        writtenBytes += chunk.length;
        if (writtenBytes > limits.maxTotalBytes) callback(new ScormPackageError("zipTooLarge"));
        else callback(null, chunk);
      },
    });
    // "wx": duplicate entry names must not overwrite an already extracted file.
    await pipeline(await openEntry(zip, entry), counter, createWriteStream(target, { flags: "wx" }));
    files += 1;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      zip.on("error", reject);
      zip.on("end", resolve);
      zip.on("entry", (entry: Entry) => {
        handle(entry).then(() => zip.readEntry(), reject);
      });
      zip.readEntry();
    });
  } finally {
    zip.close();
  }
  return { files, bytes: writtenBytes };
}
