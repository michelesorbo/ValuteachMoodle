import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  courseFileKey,
  deleteStored,
  openStored,
  resolveStoragePath,
  sanitizeFileName,
  UploadTooLargeError,
  writeUpload,
} from "./storage";

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
}

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "newlms-storage-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("resolveStoragePath", () => {
  it("resolves keys inside the root", () => {
    expect(resolveStoragePath("courses/a/files/b", root)).toBe(path.join(root, "courses/a/files/b"));
  });

  it("rejects keys that escape the root", () => {
    expect(() => resolveStoragePath("../outside", root)).toThrow();
    expect(() => resolveStoragePath("courses/../../outside", root)).toThrow();
    expect(() => resolveStoragePath("/etc/passwd", root)).toThrow();
    expect(() => resolveStoragePath("", root)).toThrow();
    expect(() => resolveStoragePath("a\0b", root)).toThrow();
  });
});

describe("writeUpload", () => {
  it("writes the stream and returns its size", async () => {
    const key = courseFileKey("course", "file");
    const size = await writeUpload(key, streamOf("hello ", "world"), 1024, root);
    expect(size).toBe(11);
    expect(await readFile(resolveStoragePath(key, root), "utf8")).toBe("hello world");
  });

  it("aborts and removes the partial file when the limit is exceeded", async () => {
    const key = courseFileKey("course", "big");
    await expect(writeUpload(key, streamOf("12345", "67890"), 8, root)).rejects.toBeInstanceOf(
      UploadTooLargeError,
    );
    expect(await readdir(path.dirname(resolveStoragePath(key, root)))).toEqual([]);
  });

  it("never overwrites an existing file", async () => {
    const key = courseFileKey("course", "same");
    await writeUpload(key, streamOf("first"), 1024, root);
    await expect(writeUpload(key, streamOf("second"), 1024, root)).rejects.toThrow();
  });
});

describe("openStored / deleteStored", () => {
  it("opens existing files and returns null for missing ones", async () => {
    const key = courseFileKey("course", "file");
    await writeUpload(key, streamOf("abc"), 1024, root);
    expect((await openStored(key, root))?.size).toBe(3);
    expect(await openStored(courseFileKey("course", "missing"), root)).toBeNull();
  });

  it("deletes files and whole course directories", async () => {
    const key = courseFileKey("course", "file");
    await writeUpload(key, streamOf("abc"), 1024, root);
    await deleteStored("courses/course", root);
    expect(await openStored(key, root)).toBeNull();
    await expect(deleteStored("courses/course", root)).resolves.toBeUndefined();
  });
});

describe("sanitizeFileName", () => {
  it("removes path separators and control characters", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe(".._.._etc_passwd");
    expect(sanitizeFileName("a\r\nb.pdf")).toBe("ab.pdf");
    expect(sanitizeFileName("dispensa 1.pdf")).toBe("dispensa 1.pdf");
  });

  it("falls back to a default name", () => {
    expect(sanitizeFileName("")).toBe("file");
    expect(sanitizeFileName("..")).toBe("file");
  });
});
