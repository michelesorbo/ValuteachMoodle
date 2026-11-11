import { describe, expect, it } from "vitest";
import { isAdmin } from "./roles";

describe("isAdmin", () => {
  it("is true for the admin role", () => {
    expect(isAdmin({ role: "admin" })).toBe(true);
  });

  it("handles Better Auth comma-separated roles", () => {
    expect(isAdmin({ role: "user, admin" })).toBe(true);
  });

  it("is false for regular users and missing roles", () => {
    expect(isAdmin({ role: "user" })).toBe(false);
    expect(isAdmin({ role: null })).toBe(false);
    expect(isAdmin({})).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it("does not match roles that merely contain the word admin", () => {
    expect(isAdmin({ role: "administrator" })).toBe(false);
  });
});
