import { describe, expect, it } from "vitest";
import {
  canCreateCourse,
  canDeleteCourse,
  canManageCourse,
  canManageEnrollment,
  canTrackProgress,
  canViewCourse,
  type CourseAccess,
} from "./permissions";

const admin: CourseAccess = { isAdmin: true, role: null };
const teacher: CourseAccess = { isAdmin: false, role: "teacher" };
const student: CourseAccess = { isAdmin: false, role: "student" };
const outsider: CourseAccess = { isAdmin: false, role: null };

describe("course permissions", () => {
  it("only admins create and delete courses", () => {
    expect(canCreateCourse({ isAdmin: true })).toBe(true);
    expect(canCreateCourse({ isAdmin: false })).toBe(false);
    expect(canDeleteCourse(admin)).toBe(true);
    expect(canDeleteCourse(teacher)).toBe(false);
    expect(canDeleteCourse(student)).toBe(false);
  });

  it("only enrolled users and admins view a course", () => {
    expect(canViewCourse(admin)).toBe(true);
    expect(canViewCourse(teacher)).toBe(true);
    expect(canViewCourse(student)).toBe(true);
    expect(canViewCourse(outsider)).toBe(false);
  });

  it("admins and the course teachers manage lessons", () => {
    expect(canManageCourse(admin)).toBe(true);
    expect(canManageCourse(teacher)).toBe(true);
    expect(canManageCourse(student)).toBe(false);
    expect(canManageCourse(outsider)).toBe(false);
  });

  it("teachers enroll students but only admins assign teachers", () => {
    expect(canManageEnrollment(teacher, "student")).toBe(true);
    expect(canManageEnrollment(teacher, "teacher")).toBe(false);
    expect(canManageEnrollment(admin, "teacher")).toBe(true);
    expect(canManageEnrollment(admin, "student")).toBe(true);
    expect(canManageEnrollment(student, "student")).toBe(false);
    expect(canManageEnrollment(outsider, "student")).toBe(false);
  });

  it("roles are per course: the same person can teach one course and study another", () => {
    const inCourseA: CourseAccess = { isAdmin: false, role: "teacher" };
    const inCourseB: CourseAccess = { isAdmin: false, role: "student" };
    expect(canManageCourse(inCourseA)).toBe(true);
    expect(canManageCourse(inCourseB)).toBe(false);
    expect(canTrackProgress(inCourseA)).toBe(false);
    expect(canTrackProgress(inCourseB)).toBe(true);
  });

  it("progress is tracked for students only", () => {
    expect(canTrackProgress(student)).toBe(true);
    expect(canTrackProgress(teacher)).toBe(false);
    expect(canTrackProgress(admin)).toBe(false);
    expect(canTrackProgress({ isAdmin: true, role: "student" })).toBe(true);
  });
});
