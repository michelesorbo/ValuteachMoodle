import { describe, expect, it } from "vitest";
import { applyCommit, commitSchema, emptyAttempt, totalSecondsOf } from "./tracking";

const commit = (cmi: Record<string, string>, sessionSeconds = 0, finished = false) => ({
  cmi,
  sessionSeconds,
  finished,
});

describe("applyCommit", () => {
  it("stores status, score and resume data", () => {
    const { attempt, completed } = applyCommit(
      emptyAttempt,
      commit(
        {
          "cmi.core.lesson_status": "incomplete",
          "cmi.core.score.raw": "42.5",
          "cmi.core.score.max": "100",
          "cmi.suspend_data": "state",
          "cmi.core.lesson_location": "page-2",
        },
        60,
      ),
      "s1",
    );
    expect(completed).toBe(false);
    expect(attempt).toMatchObject({
      lessonStatus: "incomplete",
      scoreRaw: 42.5,
      scoreMin: null,
      scoreMax: 100,
      lastSessionId: "s1",
      lastSessionSeconds: 60,
      totalSeconds: 0,
    });
    expect(attempt.cmi["cmi.suspend_data"]).toBe("state");
  });

  it("completes the lesson on completed or passed only", () => {
    for (const [status, expected] of [
      ["completed", true],
      ["passed", true],
      ["failed", false],
      ["incomplete", false],
      ["browsed", false],
    ] as const) {
      const result = applyCommit(emptyAttempt, commit({ "cmi.core.lesson_status": status }), "s1");
      expect(result.completed, status).toBe(expected);
    }
  });

  it("keeps the previous status when the reported one is not valid", () => {
    const first = applyCommit(emptyAttempt, commit({ "cmi.core.lesson_status": "incomplete" }), "s1");
    const second = applyCommit(first.attempt, commit({ "cmi.core.lesson_status": "whatever" }), "s1");
    expect(second.attempt.lessonStatus).toBe("incomplete");
  });

  it("does not double count repeated commits of the same session", () => {
    let state = applyCommit(emptyAttempt, commit({}, 30), "s1").attempt;
    state = applyCommit(state, commit({}, 90), "s1").attempt;
    state = applyCommit(state, commit({}, 80), "s1").attempt;
    expect(totalSecondsOf(state)).toBe(90);
  });

  it("adds up the time of different sessions", () => {
    let state = applyCommit(emptyAttempt, commit({}, 100), "s1").attempt;
    state = applyCommit(state, commit({}, 50), "s2").attempt;
    expect(state).toMatchObject({ totalSeconds: 100, lastSessionId: "s2", lastSessionSeconds: 50 });
    state = applyCommit(state, commit({}, 70), "s2").attempt;
    state = applyCommit(state, commit({}, 10), "s3").attempt;
    expect(totalSecondsOf(state)).toBe(180);
  });

  it("ignores out-of-range scores", () => {
    const { attempt } = applyCommit(emptyAttempt, commit({ "cmi.core.score.raw": "150" }), "s1");
    expect(attempt.scoreRaw).toBeNull();
  });
});

describe("commitSchema", () => {
  it("accepts a normal commit", () => {
    expect(commitSchema.safeParse(commit({ "cmi.core.lesson_status": "completed" }, 12, true)).success).toBe(true);
  });

  it("rejects foreign keys, oversized values and bad durations", () => {
    expect(commitSchema.safeParse(commit({ "__proto__.x": "1" })).success).toBe(false);
    expect(commitSchema.safeParse(commit({ "cmi.suspend_data": "x".repeat(64_001) })).success).toBe(false);
    expect(commitSchema.safeParse(commit({}, -1)).success).toBe(false);
    expect(commitSchema.safeParse({ cmi: {}, sessionSeconds: "10", finished: false }).success).toBe(false);
  });
});
