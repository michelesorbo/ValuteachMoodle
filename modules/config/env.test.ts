import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const base = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  SCORM_ORIGIN: "http://scorm.localhost:3000",
};

describe("parseEnv", () => {
  it("applies the default upload limits and storage directory", () => {
    const env = parseEnv(base);
    expect(env.MAX_SCORM_UPLOAD_MB).toBe(500);
    expect(env.MAX_VIDEO_UPLOAD_MB).toBe(1024);
    expect(env.FILES_DIR).toBe("./data/files");
  });

  it("reads upload limits from the environment", () => {
    const env = parseEnv({ ...base, MAX_SCORM_UPLOAD_MB: "50", MAX_VIDEO_UPLOAD_MB: "200" });
    expect(env.MAX_SCORM_UPLOAD_MB).toBe(50);
    expect(env.MAX_VIDEO_UPLOAD_MB).toBe(200);
  });

  it("treats empty strings as unset", () => {
    expect(parseEnv({ ...base, MAX_SCORM_UPLOAD_MB: "" }).MAX_SCORM_UPLOAD_MB).toBe(500);
  });

  it("rejects invalid limits, short secrets and missing variables", () => {
    expect(() => parseEnv({ ...base, MAX_VIDEO_UPLOAD_MB: "-1" })).toThrow();
    expect(() => parseEnv({ ...base, BETTER_AUTH_SECRET: "short" })).toThrow();
    expect(() => parseEnv({ ...base, DATABASE_URL: undefined })).toThrow();
  });

  it("requires the SCORM origin to be a different host from the app", () => {
    expect(() => parseEnv({ ...base, SCORM_ORIGIN: "http://localhost:3000/scorm" })).toThrow();
    expect(() => parseEnv({ ...base, SCORM_ORIGIN: undefined })).toThrow();
    expect(parseEnv(base).SCORM_ORIGIN).toBe("http://scorm.localhost:3000");
  });
});
