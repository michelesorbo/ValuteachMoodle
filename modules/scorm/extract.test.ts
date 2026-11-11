import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import yazl from "yazl";
import { ScormPackageError } from "./errors";
import { extractZip } from "./extract";

const limits = { maxEntries: 100, maxTotalBytes: 1024 * 1024 };

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "newlms-zip-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function makeZip(
  name: string,
  entries: Record<string, string | Buffer>,
  options: { symlink?: string } = {},
): Promise<string> {
  const zip = new yazl.ZipFile();
  for (const [entryName, content] of Object.entries(entries)) {
    zip.addBuffer(Buffer.from(content), entryName);
  }
  if (options.symlink) {
    zip.addBuffer(Buffer.from("/etc/passwd"), options.symlink, { mode: 0o120777 });
  }
  zip.end();
  const target = path.join(dir, name);
  await pipeline(zip.outputStream, createWriteStream(target));
  return target;
}

async function expectRejected(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(ScormPackageError);
  expect((error as ScormPackageError).code).toBe(code);
}

describe("extractZip", () => {
  it("extracts files and nested directories", async () => {
    const zip = await makeZip("ok.zip", {
      "imsmanifest.xml": "<manifest/>",
      "content/index.html": "<html></html>",
      "__MACOSX/._index.html": "junk",
    });
    const dest = path.join(dir, "out");
    const result = await extractZip(zip, dest, limits);

    expect(result.files).toBe(2);
    expect(await readFile(path.join(dest, "content/index.html"), "utf8")).toBe("<html></html>");
    expect(await readdir(dest)).toEqual(["content", "imsmanifest.xml"]);
  });

  it("refuses entries that escape the destination (zip-slip)", async () => {
    const zip = await makeZip("slip.zip", { "aa/evil.txt": "pwned", "ok.txt": "ok" });
    // Same-length rename of "aa/evil.txt" to "../evil.txt" in both the local and central headers.
    const bytes = await readFile(zip);
    const patched = Buffer.from(bytes.toString("latin1").replaceAll("aa/evil.txt", "../evil.txt"), "latin1");
    await writeFile(zip, patched);

    const dest = path.join(dir, "out");
    await expect(extractZip(zip, dest, limits)).rejects.toBeInstanceOf(ScormPackageError);
    await expect(stat(path.join(dir, "evil.txt"))).rejects.toThrow();
    await expect(stat(dest)).rejects.toThrow();
  });

  it("refuses symbolic links", async () => {
    const zip = await makeZip("link.zip", { "index.html": "x" }, { symlink: "passwd" });
    await expectRejected(extractZip(zip, path.join(dir, "out"), limits), "unsafeZip");
  });

  it("refuses archives that inflate beyond the size limit (zip bomb)", async () => {
    // 5 MB of zeros compresses to a few kilobytes.
    const zip = await makeZip("bomb.zip", { "bomb.bin": Buffer.alloc(5 * 1024 * 1024) });
    expect((await stat(zip)).size).toBeLessThan(100 * 1024);

    const dest = path.join(dir, "out");
    await expectRejected(extractZip(zip, dest, limits), "zipTooLarge");
    await expect(stat(dest)).rejects.toThrow();
  });

  it("refuses archives with too many entries", async () => {
    const entries = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`f${i}.txt`, "x"]));
    const zip = await makeZip("many.zip", entries);
    await expectRejected(
      extractZip(zip, path.join(dir, "out"), { maxEntries: 5, maxTotalBytes: 1024 }),
      "zipTooLarge",
    );
  });

  it("refuses files that are not zip archives", async () => {
    const fake = path.join(dir, "fake.zip");
    await writeFile(fake, "this is not a zip");
    await expectRejected(extractZip(fake, path.join(dir, "out"), limits), "invalidZip");
  });
});
