import { describe, expect, it } from "vitest";
import { Scorm12Api, type CommitPayload, type ScormInit } from "./api";
import { formatScormTime, parseScormTime } from "./time";

function setup(init: Partial<ScormInit> = {}) {
  const commits: CommitPayload[] = [];
  let clock = 1_000_000;
  const api = new Scorm12Api(
    { studentId: "u1", studentName: "Rossi, Mario", cmi: {}, totalSeconds: 0, masteryScore: null, ...init },
    { onCommit: (payload) => commits.push(payload), now: () => clock },
  );
  return { api, commits, advance: (seconds: number) => (clock += seconds * 1000) };
}

describe("SCORM 1.2 API lifecycle", () => {
  it("requires LMSInitialize before anything else", () => {
    const { api } = setup();
    expect(api.LMSGetValue("cmi.core.lesson_status")).toBe("");
    expect(api.LMSGetLastError()).toBe("301");
    expect(api.LMSSetValue("cmi.core.lesson_status", "completed")).toBe("false");
    expect(api.LMSCommit("")).toBe("false");
    expect(api.LMSFinish("")).toBe("false");
    expect(api.LMSGetErrorString("301")).toBe("Not initialized");
  });

  it("initializes a first attempt", () => {
    const { api } = setup();
    expect(api.LMSInitialize("")).toBe("true");
    expect(api.LMSGetLastError()).toBe("0");
    expect(api.LMSGetValue("cmi.core.student_id")).toBe("u1");
    expect(api.LMSGetValue("cmi.core.student_name")).toBe("Rossi, Mario");
    expect(api.LMSGetValue("cmi.core.lesson_status")).toBe("not attempted");
    expect(api.LMSGetValue("cmi.core.entry")).toBe("ab-initio");
    expect(api.LMSGetValue("cmi.core.total_time")).toBe("0000:00:00.00");
    expect(api.LMSGetValue("cmi.core.credit")).toBe("credit");
    expect(api.LMSGetValue("cmi.suspend_data")).toBe("");
  });

  it("rejects a non-empty parameter and a double initialize", () => {
    const { api } = setup();
    expect(api.LMSInitialize("x")).toBe("false");
    expect(api.LMSGetLastError()).toBe("201");
    api.LMSInitialize("");
    expect(api.LMSInitialize("")).toBe("false");
    expect(api.LMSGetLastError()).toBe("101");
  });

  it("works when the functions are called detached from the object", () => {
    const { api } = setup();
    const { LMSInitialize, LMSGetValue } = api;
    expect(LMSInitialize("")).toBe("true");
    expect(LMSGetValue("cmi.core.student_id")).toBe("u1");
  });
});

describe("SCORM 1.2 data model", () => {
  it("validates status, score, exit and session time", () => {
    const { api } = setup();
    api.LMSInitialize("");

    expect(api.LMSSetValue("cmi.core.lesson_status", "incomplete")).toBe("true");
    expect(api.LMSSetValue("cmi.core.lesson_status", "done")).toBe("false");
    expect(api.LMSGetLastError()).toBe("405");
    expect(api.LMSSetValue("cmi.core.lesson_status", "not attempted")).toBe("false");

    expect(api.LMSSetValue("cmi.core.score.raw", "85.5")).toBe("true");
    expect(api.LMSSetValue("cmi.core.score.raw", 90)).toBe("true");
    expect(api.LMSSetValue("cmi.core.score.raw", "101")).toBe("false");
    expect(api.LMSSetValue("cmi.core.score.raw", "abc")).toBe("false");
    expect(api.LMSGetValue("cmi.core.score.raw")).toBe("90");

    expect(api.LMSSetValue("cmi.core.exit", "suspend")).toBe("true");
    expect(api.LMSSetValue("cmi.core.exit", "bye")).toBe("false");
    expect(api.LMSSetValue("cmi.core.session_time", "0000:10:00.00")).toBe("true");
    expect(api.LMSSetValue("cmi.core.session_time", "10 minutes")).toBe("false");
  });

  it("enforces read-only and write-only elements", () => {
    const { api } = setup();
    api.LMSInitialize("");

    expect(api.LMSSetValue("cmi.core.student_id", "hacker")).toBe("false");
    expect(api.LMSGetLastError()).toBe("403");
    expect(api.LMSSetValue("cmi.core.total_time", "9999:00:00")).toBe("false");
    expect(api.LMSSetValue("cmi.core._children", "x")).toBe("false");
    expect(api.LMSGetLastError()).toBe("402");

    api.LMSSetValue("cmi.core.exit", "suspend");
    expect(api.LMSGetValue("cmi.core.exit")).toBe("");
    expect(api.LMSGetLastError()).toBe("404");
    expect(api.LMSGetValue("cmi.core.session_time")).toBe("");
    expect(api.LMSGetLastError()).toBe("404");
  });

  it("reports unknown elements", () => {
    const { api } = setup();
    api.LMSInitialize("");
    expect(api.LMSGetValue("cmi.core.nonexistent")).toBe("");
    expect(api.LMSGetLastError()).toBe("401");
    expect(api.LMSSetValue("foo.bar", "1")).toBe("false");
    expect(api.LMSGetLastError()).toBe("201");
    expect(api.LMSGetValue("cmi.core.lesson_status._children")).toBe("");
    expect(api.LMSGetLastError()).toBe("202");
    expect(api.LMSGetValue("cmi.core._count")).toBe("");
    expect(api.LMSGetLastError()).toBe("203");
  });

  it("supports _children, objectives and interactions with _count", () => {
    const { api } = setup();
    api.LMSInitialize("");
    expect(api.LMSGetValue("cmi.core.score._children")).toBe("raw,min,max");
    expect(api.LMSGetValue("cmi.objectives._count")).toBe("0");

    expect(api.LMSSetValue("cmi.objectives.0.id", "obj-a")).toBe("true");
    expect(api.LMSSetValue("cmi.objectives.0.status", "passed")).toBe("true");
    expect(api.LMSSetValue("cmi.objectives.1.id", "obj-b")).toBe("true");
    expect(api.LMSGetValue("cmi.objectives._count")).toBe("2");
    expect(api.LMSGetValue("cmi.objectives.0.id")).toBe("obj-a");

    expect(api.LMSSetValue("cmi.interactions.0.id", "q1")).toBe("true");
    expect(api.LMSSetValue("cmi.interactions.0.correct_responses.0.pattern", "a")).toBe("true");
    expect(api.LMSGetValue("cmi.interactions._count")).toBe("1");
    expect(api.LMSGetValue("cmi.interactions.0.correct_responses._count")).toBe("1");
    expect(api.LMSGetValue("cmi.interactions.0.id")).toBe("");
    expect(api.LMSGetLastError()).toBe("404");
  });

  it("appends comments and limits the size of a value", () => {
    const { api } = setup();
    api.LMSInitialize("");
    api.LMSSetValue("cmi.comments", "one ");
    api.LMSSetValue("cmi.comments", "two");
    expect(api.LMSGetValue("cmi.comments")).toBe("one two");
    expect(api.LMSSetValue("cmi.suspend_data", "x".repeat(64_001))).toBe("false");
    expect(api.LMSSetValue("cmi.suspend_data", "x".repeat(10_000))).toBe("true");
  });
});

describe("SCORM 1.2 commit and finish", () => {
  it("commits what the content set, without LMS-owned elements", () => {
    const { api, commits } = setup();
    api.LMSInitialize("");
    api.LMSSetValue("cmi.core.lesson_status", "incomplete");
    api.LMSSetValue("cmi.core.lesson_location", "page-3");
    api.LMSSetValue("cmi.suspend_data", "state");
    api.LMSSetValue("cmi.core.session_time", "0000:02:30.00");
    expect(api.LMSCommit("")).toBe("true");

    expect(commits).toEqual([
      {
        cmi: {
          "cmi.core.lesson_status": "incomplete",
          "cmi.core.lesson_location": "page-3",
          "cmi.suspend_data": "state",
        },
        sessionSeconds: 150,
        finished: false,
      },
    ]);
  });

  it("uses the wall clock when the content never sets session_time", () => {
    const { api, commits, advance } = setup();
    api.LMSInitialize("");
    advance(42);
    api.LMSCommit("");
    expect(commits[0].sessionSeconds).toBe(42);
  });

  it("completes on finish when the content never set a status", () => {
    const { api, commits } = setup();
    api.LMSInitialize("");
    expect(api.LMSFinish("")).toBe("true");
    expect(commits.at(-1)).toMatchObject({
      finished: true,
      cmi: { "cmi.core.lesson_status": "completed" },
    });
    expect(api.isRunning).toBe(false);
    expect(api.LMSGetValue("cmi.core.lesson_status")).toBe("");
    expect(api.LMSGetLastError()).toBe("301");
  });

  it("keeps the status chosen by the content", () => {
    const { api, commits } = setup();
    api.LMSInitialize("");
    api.LMSSetValue("cmi.core.lesson_status", "incomplete");
    api.LMSFinish("");
    expect(commits.at(-1)?.cmi["cmi.core.lesson_status"]).toBe("incomplete");
  });

  it("applies the mastery score from the manifest", () => {
    const passed = setup({ masteryScore: 80 });
    passed.api.LMSInitialize("");
    expect(passed.api.LMSGetValue("cmi.student_data.mastery_score")).toBe("80");
    passed.api.LMSSetValue("cmi.core.lesson_status", "completed");
    passed.api.LMSSetValue("cmi.core.score.raw", "80");
    passed.api.LMSFinish("");
    expect(passed.commits.at(-1)?.cmi["cmi.core.lesson_status"]).toBe("passed");

    const failed = setup({ masteryScore: 80 });
    failed.api.LMSInitialize("");
    failed.api.LMSSetValue("cmi.core.lesson_status", "completed");
    failed.api.LMSSetValue("cmi.core.score.raw", "79.9");
    failed.api.LMSFinish("");
    expect(failed.commits.at(-1)?.cmi["cmi.core.lesson_status"]).toBe("failed");
  });

  it("resumes a suspended attempt", () => {
    const { api } = setup({
      cmi: {
        "cmi.core.lesson_status": "incomplete",
        "cmi.core.lesson_location": "page-3",
        "cmi.core.exit": "suspend",
        "cmi.suspend_data": "state",
        "cmi.objectives.0.id": "obj-a",
      },
      totalSeconds: 3725.5,
    });
    api.LMSInitialize("");
    expect(api.LMSGetValue("cmi.core.entry")).toBe("resume");
    expect(api.LMSGetValue("cmi.core.lesson_status")).toBe("incomplete");
    expect(api.LMSGetValue("cmi.core.lesson_location")).toBe("page-3");
    expect(api.LMSGetValue("cmi.suspend_data")).toBe("state");
    expect(api.LMSGetValue("cmi.core.total_time")).toBe("0001:02:05.50");
    expect(api.LMSGetValue("cmi.objectives._count")).toBe("1");
  });

  it("does not resume when the previous session did not suspend", () => {
    const { api } = setup({ cmi: { "cmi.core.lesson_status": "completed" } });
    api.LMSInitialize("");
    expect(api.LMSGetValue("cmi.core.entry")).toBe("");
  });
});

describe("SCORM time", () => {
  it("parses and formats CMITimespan values", () => {
    expect(parseScormTime("0001:02:05.50")).toBe(3725.5);
    expect(parseScormTime("00:00:07")).toBe(7);
    expect(parseScormTime("00:00:07.5")).toBe(7.5);
    expect(parseScormTime("7 seconds")).toBeNull();
    expect(formatScormTime(0)).toBe("0000:00:00.00");
    expect(formatScormTime(3725.5)).toBe("0001:02:05.50");
    expect(formatScormTime(1e12)).toBe("9999:59:59.99");
  });
});
