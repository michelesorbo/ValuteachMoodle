import { describe, expect, it } from "vitest";
import { signScormToken, verifyScormToken, type ScormTokenPayload } from "./token";

const secret = "s".repeat(32);
const payload: ScormTokenPayload = {
  userId: "user-1",
  lessonId: "lesson-1",
  packageKey: "courses/c/scorm/p",
  sessionId: "session-1",
  exp: 2_000,
};

describe("SCORM launch token", () => {
  it("round-trips a valid token", () => {
    const token = signScormToken(payload, secret);
    expect(token).toMatch(/^[\w-]+\.[\w-]+$/);
    expect(verifyScormToken(token, secret, 1_000)).toEqual(payload);
  });

  it("rejects expired tokens", () => {
    const token = signScormToken(payload, secret);
    expect(verifyScormToken(token, secret, 2_000)).toBeNull();
    expect(verifyScormToken(token, secret, 3_000)).toBeNull();
  });

  it("rejects a wrong secret", () => {
    expect(verifyScormToken(signScormToken(payload, secret), "x".repeat(32), 1_000)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const [, signature] = signScormToken(payload, secret).split(".");
    const forged = Buffer.from(JSON.stringify({ ...payload, userId: "someone-else" })).toString("base64url");
    expect(verifyScormToken(`${forged}.${signature}`, secret, 1_000)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    for (const token of ["", "abc", "a.b.c", ".", "a.", ".b"]) {
      expect(verifyScormToken(token, secret, 1_000), token).toBeNull();
    }
  });
});
