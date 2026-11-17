import { describe, expect, it } from "vitest";
import {
  ADMIN_SCOPES,
  ALL_SCOPES,
  canGrant,
  effectiveRoleScopes,
  parseScopes,
  scopesAllowedForKind,
} from "./scopes";

describe("scopes", () => {
  it("has unique scope names", () => {
    expect(new Set(ALL_SCOPES).size).toBe(ALL_SCOPES.length);
  });

  it("parseScopes drops unknown values and duplicates", () => {
    expect(parseScopes(["course:view", "nope", "course:view", 3])).toEqual(["course:view"]);
  });

  it("course roles may only hold course scopes", () => {
    expect(scopesAllowedForKind("course", ["course:view"])).toBe(true);
    expect(scopesAllowedForKind("course", ["course:view", "users:manage"])).toBe(false);
    expect(scopesAllowedForKind("global", ["users:manage", "course:view"])).toBe(true);
  });

  it("the admin role is computed and does not track progress", () => {
    const scopes = effectiveRoleScopes({ systemKey: "admin" }, []);
    expect(scopes).toEqual(ADMIN_SCOPES);
    expect(scopes).toContain("users:manage");
    expect(scopes).not.toContain("course:learn");
  });

  it("other roles grant what is stored, ignoring unknown scopes", () => {
    expect(effectiveRoleScopes({ systemKey: null }, ["course:view", "legacy"])).toEqual(["course:view"]);
  });

  it("canGrant requires holding every scope", () => {
    expect(canGrant(new Set(["course:view", "course:manage"]), ["course:view"])).toBe(true);
    expect(canGrant(new Set(["course:view"]), ["course:view", "course:manage"])).toBe(false);
    // Seeing or taking a course is harmless: it can be given without holding it.
    expect(canGrant(new Set(), ["course:view", "course:learn"])).toBe(true);
    expect(canGrant(new Set(), [])).toBe(true);
  });
});
