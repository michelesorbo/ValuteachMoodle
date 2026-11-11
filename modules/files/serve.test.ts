import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentTypeFor, parseRange, serveFile } from "./serve";

describe("parseRange", () => {
  it("returns null without a usable header", () => {
    expect(parseRange(null, 100)).toBeNull();
    expect(parseRange("items=0-1", 100)).toBeNull();
    expect(parseRange("bytes=0-1,5-6", 100)).toBeNull();
    expect(parseRange("bytes=-", 100)).toBeNull();
  });

  it("parses closed, open and suffix ranges", () => {
    expect(parseRange("bytes=0-9", 100)).toEqual({ start: 0, end: 9 });
    expect(parseRange("bytes=90-", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=50-500", 100)).toEqual({ start: 50, end: 99 });
    expect(parseRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=-500", 100)).toEqual({ start: 0, end: 99 });
  });

  it("flags ranges outside the file", () => {
    expect(parseRange("bytes=100-", 100)).toBe("unsatisfiable");
    expect(parseRange("bytes=9-5", 100)).toBe("unsatisfiable");
    expect(parseRange("bytes=-0", 100)).toBe("unsatisfiable");
    expect(parseRange("bytes=0-", 0)).toBe("unsatisfiable");
  });
});

describe("contentTypeFor", () => {
  it("maps common extensions and falls back to a binary type", () => {
    expect(contentTypeFor("index.HTML")).toBe("text/html; charset=utf-8");
    expect(contentTypeFor("a/b/video.mp4")).toBe("video/mp4");
    expect(contentTypeFor("unknown.xyz")).toBe("application/octet-stream");
  });
});

describe("serveFile", () => {
  let dir: string;
  let file: string;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "newlms-serve-"));
    file = path.join(dir, "data.txt");
    await writeFile(file, "0123456789");
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("serves the whole file", async () => {
    const response = await serveFile(new Request("http://x/"), file);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-length")).toBe("10");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(await response.text()).toBe("0123456789");
  });

  it("serves a byte range", async () => {
    const response = await serveFile(new Request("http://x/", { headers: { range: "bytes=2-5" } }), file);
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(response.headers.get("content-length")).toBe("4");
    expect(await response.text()).toBe("2345");
  });

  it("answers 416 for a range outside the file and 404 for missing files or directories", async () => {
    const outside = await serveFile(new Request("http://x/", { headers: { range: "bytes=50-" } }), file);
    expect(outside.status).toBe(416);
    expect(outside.headers.get("content-range")).toBe("bytes */10");
    expect((await serveFile(new Request("http://x/"), path.join(dir, "missing"))).status).toBe(404);
    expect((await serveFile(new Request("http://x/"), dir)).status).toBe(404);
  });
});
