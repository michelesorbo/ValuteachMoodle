import { describe, expect, it } from "vitest";
import type { Scope } from "@/modules/auth/scopes";
import {
  canCreateCourse,
  canDeleteCourse,
  canManageCourse,
  canManageEnrollment,
  canTrackProgress,
  canViewCourse,
  type CourseAccess,
} from "./permissions";

const access = (...scopes: Scope[]): CourseAccess => ({ scopes: new Set(scopes) });

const studentRole: Scope[] = ["course:view", "course:learn"];
const teacherRole: Scope[] = ["course:view", "course:manage", "course:enrollments:manage"];

const student = access(...studentRole);
const teacher = access(...teacherRole);
const admin = access(
  "course:view",
  "course:manage",
  "course:delete",
  "course:enrollments:manage",
  "course:enrollments:assign-privileged",
);
const outsider = access();

describe("course permissions", () => {
  it("creating courses is a global scope", () => {
    expect(canCreateCourse(new Set<Scope>(["courses:create"]))).toBe(true);
    expect(canCreateCourse(new Set<Scope>(["users:manage"]))).toBe(false);
  });

  it("only course:delete deletes", () => {
    expect(canDeleteCourse(admin)).toBe(true);
    expect(canDeleteCourse(teacher)).toBe(false);
    expect(canDeleteCourse(student)).toBe(false);
  });

  it("viewing needs course:view: enrollment alone is not enough", () => {
    expect(canViewCourse(student)).toBe(true);
    expect(canViewCourse(teacher)).toBe(true);
    expect(canViewCourse(outsider)).toBe(false);
    expect(canViewCourse(access("course:learn"))).toBe(false);
  });

  it("managing lessons needs course:manage", () => {
    expect(canManageCourse(admin)).toBe(true);
    expect(canManageCourse(teacher)).toBe(true);
    expect(canManageCourse(student)).toBe(false);
  });

  it("teachers enroll students but not other teachers", () => {
    expect(canManageEnrollment(teacher, studentRole)).toBe(true);
    expect(canManageEnrollment(teacher, teacherRole)).toBe(false);
    expect(canManageEnrollment(admin, teacherRole)).toBe(true);
    expect(canManageEnrollment(student, studentRole)).toBe(false);
    expect(canManageEnrollment(outsider, studentRole)).toBe(false);
  });

  it("nobody hands out scopes they do not hold", () => {
    const custom = access("course:view", "course:enrollments:manage");
    expect(canManageEnrollment(custom, studentRole)).toBe(true);
    const withPrivilege = access("course:enrollments:manage", "course:enrollments:assign-privileged");
    expect(canManageEnrollment(withPrivilege, teacherRole)).toBe(false); // course:manage not held
  });

  it("progress is tracked for course:learn only", () => {
    expect(canTrackProgress(student)).toBe(true);
    expect(canTrackProgress(teacher)).toBe(false);
    expect(canTrackProgress(admin)).toBe(false);
  });
});
