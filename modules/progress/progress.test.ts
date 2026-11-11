import { describe, expect, it } from "vitest";
import { computeCourseProgress, isManuallyCompletable, progressFromCounts } from "./progress";

describe("computeCourseProgress", () => {
  it("is not completed when the course has no lessons", () => {
    expect(computeCourseProgress([], [])).toEqual({
      completed: 0,
      total: 0,
      percent: 0,
      isCompleted: false,
    });
  });

  it("tracks partial progress", () => {
    const progress = computeCourseProgress(["a", "b", "c"], ["a"]);
    expect(progress).toMatchObject({ completed: 1, total: 3, percent: 33, isCompleted: false });
  });

  it("completes the course only when every lesson is completed", () => {
    expect(computeCourseProgress(["a", "b"], ["a", "b"]).isCompleted).toBe(true);
    expect(computeCourseProgress(["a", "b"], ["b"]).isCompleted).toBe(false);
  });

  it("ignores completions of lessons that are no longer in the course", () => {
    const progress = computeCourseProgress(["a", "b"], ["a", "deleted"]);
    expect(progress).toMatchObject({ completed: 1, total: 2, isCompleted: false });
  });

  it("never shows 100% before the last lesson", () => {
    expect(progressFromCounts(199, 200).percent).toBe(99);
    expect(progressFromCounts(200, 200).percent).toBe(100);
  });

  it("clamps inconsistent counts", () => {
    expect(progressFromCounts(5, 3)).toMatchObject({ completed: 3, total: 3, isCompleted: true });
    expect(progressFromCounts(-1, 3).completed).toBe(0);
  });
});

describe("isManuallyCompletable", () => {
  it("allows the button only for text and file lessons", () => {
    expect(isManuallyCompletable("text")).toBe(true);
    expect(isManuallyCompletable("file")).toBe(true);
    expect(isManuallyCompletable("video")).toBe(false);
    expect(isManuallyCompletable("scorm")).toBe(false);
  });
});
