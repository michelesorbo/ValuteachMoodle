import { formatScormTime, isScormTimespan, parseScormTime } from "./time";

/**
 * SCORM 1.2 run-time API (the object content finds as `window.API`).
 * Pure logic, no DOM and no network: persistence is delegated to `onCommit`.
 *
 * Validation is strict on the elements the LMS relies on (status, score, time)
 * and lenient elsewhere, because real-world packages often bend the spec.
 */

/** cmi element name -> value, e.g. { "cmi.core.lesson_status": "incomplete" }. */
export type CmiData = Record<string, string>;

export type ScormInit = {
  studentId: string;
  studentName: string;
  /** Elements saved by previous sessions (see CommitPayload.cmi). */
  cmi: CmiData;
  /** Time accumulated by previous sessions, in seconds. */
  totalSeconds: number;
  /** adlcp:masteryscore from the manifest, when declared. */
  masteryScore: number | null;
};

export type CommitPayload = {
  /** Every element the content has set and the LMS must keep. */
  cmi: CmiData;
  /** Duration of the current session (cmi.core.session_time, or wall clock if never set). */
  sessionSeconds: number;
  /** True when sent by LMSFinish. */
  finished: boolean;
};

export type ScormApiOptions = {
  onCommit: (payload: CommitPayload) => void;
  /** Milliseconds clock, injectable for tests. */
  now?: () => number;
};

export const LESSON_STATUSES = [
  "passed",
  "completed",
  "failed",
  "incomplete",
  "browsed",
  "not attempted",
] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];

/** Statuses that complete the lesson in the LMS. */
export function isCompletedStatus(status: string): boolean {
  return status === "completed" || status === "passed";
}

export const MAX_ELEMENT_LENGTH = 64_000;

const ERRORS: Record<string, string> = {
  "0": "No error",
  "101": "General exception",
  "201": "Invalid argument error",
  "202": "Element cannot have children",
  "203": "Element not an array - cannot have count",
  "301": "Not initialized",
  "401": "Not implemented error",
  "402": "Invalid set value, element is a keyword",
  "403": "Element is read only",
  "404": "Element is write only",
  "405": "Incorrect data type",
};

const CHILDREN: Record<string, string> = {
  "cmi.core._children":
    "student_id,student_name,lesson_location,credit,lesson_status,entry,score,total_time,lesson_mode,exit,session_time",
  "cmi.core.score._children": "raw,min,max",
  "cmi.objectives._children": "id,score,status",
  "cmi.student_data._children": "mastery_score,max_time_allowed,time_limit_action",
  "cmi.student_preference._children": "audio,language,speed,text",
  "cmi.interactions._children":
    "id,objectives,time,type,correct_responses,weighting,student_response,result,latency",
};

const READ_ONLY = new Set([
  "cmi.core.student_id",
  "cmi.core.student_name",
  "cmi.core.credit",
  "cmi.core.entry",
  "cmi.core.total_time",
  "cmi.core.lesson_mode",
  "cmi.launch_data",
  "cmi.comments_from_lms",
  "cmi.student_data.mastery_score",
  "cmi.student_data.max_time_allowed",
  "cmi.student_data.time_limit_action",
]);

const WRITE_ONLY = new Set(["cmi.core.exit", "cmi.core.session_time"]);

const SCALAR_ELEMENTS = new Set([
  ...READ_ONLY,
  ...WRITE_ONLY,
  "cmi.core.lesson_location",
  "cmi.core.lesson_status",
  "cmi.core.score.raw",
  "cmi.core.score.min",
  "cmi.core.score.max",
  "cmi.suspend_data",
  "cmi.comments",
  "cmi.student_preference.audio",
  "cmi.student_preference.language",
  "cmi.student_preference.speed",
  "cmi.student_preference.text",
]);

const OBJECTIVE = /^cmi\.objectives\.\d{1,3}\.(id|status|score\.(raw|min|max))$/;
const INTERACTION =
  /^cmi\.interactions\.\d{1,4}\.(id|time|type|weighting|student_response|result|latency|objectives\.\d{1,3}\.id|correct_responses\.\d{1,3}\.pattern)$/;
const COUNT = /^(cmi\.objectives|cmi\.interactions|cmi\.interactions\.\d{1,4}\.(objectives|correct_responses))\._count$/;

const EXIT_VALUES = new Set(["time-out", "suspend", "logout", ""]);
const SETTABLE_STATUSES = new Set<string>(LESSON_STATUSES.filter((status) => status !== "not attempted"));

function isScore(value: string): boolean {
  if (value === "") return true;
  if (!/^-?\d+(\.\d+)?$/.test(value)) return false;
  const number = Number(value);
  return number >= 0 && number <= 100;
}

export class Scorm12Api {
  private state: "idle" | "running" | "finished" = "idle";
  private lastError = "0";
  private readonly values = new Map<string, string>();
  private startedAt = 0;
  private readonly now: () => number;

  constructor(
    private readonly init: ScormInit,
    private readonly options: ScormApiOptions,
  ) {
    this.now = options.now ?? Date.now;
    // Content looks the functions up on the object and may call them detached.
    this.LMSInitialize = this.LMSInitialize.bind(this);
    this.LMSFinish = this.LMSFinish.bind(this);
    this.LMSGetValue = this.LMSGetValue.bind(this);
    this.LMSSetValue = this.LMSSetValue.bind(this);
    this.LMSCommit = this.LMSCommit.bind(this);
    this.LMSGetLastError = this.LMSGetLastError.bind(this);
    this.LMSGetErrorString = this.LMSGetErrorString.bind(this);
    this.LMSGetDiagnostic = this.LMSGetDiagnostic.bind(this);
  }

  /** True between LMSInitialize and LMSFinish. */
  get isRunning(): boolean {
    return this.state === "running";
  }

  LMSInitialize(parameter: string = ""): string {
    if (parameter !== "") return this.fail("201");
    if (this.state === "running") return this.fail("101");

    this.values.clear();
    for (const [key, value] of Object.entries(this.init.cmi)) this.values.set(key, value);

    const previousExit = this.values.get("cmi.core.exit") ?? "";
    const previousStatus = this.values.get("cmi.core.lesson_status") ?? "not attempted";
    this.values.delete("cmi.core.exit");
    this.values.delete("cmi.core.session_time");

    this.values.set("cmi.core.student_id", this.init.studentId);
    this.values.set("cmi.core.student_name", this.init.studentName);
    this.values.set("cmi.core.credit", "credit");
    this.values.set("cmi.core.lesson_mode", "normal");
    this.values.set("cmi.core.lesson_status", previousStatus);
    this.values.set("cmi.core.total_time", formatScormTime(this.init.totalSeconds));
    this.values.set(
      "cmi.core.entry",
      previousExit === "suspend" ? "resume" : previousStatus === "not attempted" ? "ab-initio" : "",
    );
    if (this.init.masteryScore !== null) {
      this.values.set("cmi.student_data.mastery_score", String(this.init.masteryScore));
    }

    this.startedAt = this.now();
    this.state = "running";
    return this.ok("true");
  }

  LMSFinish(parameter: string = ""): string {
    if (parameter !== "") return this.fail("201");
    if (this.state !== "running") return this.fail("301");

    // SCORM 1.2 RTE 3.4.4: a SCO that never sets its status is considered completed,
    // and a mastery score declared in the manifest decides between passed and failed.
    let status = this.values.get("cmi.core.lesson_status") ?? "not attempted";
    if (status === "not attempted") status = "completed";
    const raw = this.values.get("cmi.core.score.raw") ?? "";
    if (this.init.masteryScore !== null && raw !== "") {
      status = Number(raw) >= this.init.masteryScore ? "passed" : "failed";
    }
    this.values.set("cmi.core.lesson_status", status);

    this.options.onCommit(this.buildPayload(true));
    this.state = "finished";
    return this.ok("true");
  }

  LMSGetValue(element: string): string {
    if (this.state !== "running") return this.fail("301", "");
    if (typeof element !== "string" || element === "") return this.fail("201", "");

    if (element in CHILDREN) return this.ok(CHILDREN[element]);
    if (element.endsWith("._children")) return this.fail("202", "");
    if (COUNT.test(element)) return this.ok(String(this.countChildren(element.slice(0, -"._count".length))));
    if (element.endsWith("._count")) return this.fail("203", "");
    if (WRITE_ONLY.has(element) || INTERACTION.test(element)) return this.fail("404", "");
    if (!this.isKnown(element)) return this.fail(element.startsWith("cmi.") ? "401" : "201", "");

    return this.ok(this.values.get(element) ?? "");
  }

  LMSSetValue(element: string, value: unknown): string {
    if (this.state !== "running") return this.fail("301");
    if (typeof element !== "string" || element === "") return this.fail("201");

    const text = value === null || value === undefined ? "" : String(value);
    if (element.endsWith("._children") || element.endsWith("._count")) return this.fail("402");
    if (READ_ONLY.has(element)) return this.fail("403");
    if (!this.isKnown(element)) return this.fail(element.startsWith("cmi.") ? "401" : "201");
    if (text.length > MAX_ELEMENT_LENGTH) return this.fail("405");

    switch (element) {
      case "cmi.core.lesson_status":
        if (!SETTABLE_STATUSES.has(text)) return this.fail("405");
        break;
      case "cmi.core.exit":
        if (!EXIT_VALUES.has(text)) return this.fail("405");
        break;
      case "cmi.core.session_time":
        if (!isScormTimespan(text)) return this.fail("405");
        break;
      case "cmi.core.score.raw":
      case "cmi.core.score.min":
      case "cmi.core.score.max":
        if (!isScore(text)) return this.fail("405");
        break;
      case "cmi.comments":
        // Comments accumulate (SCORM 1.2 RTE 3.4.4.5).
        this.values.set(element, ((this.values.get(element) ?? "") + text).slice(0, MAX_ELEMENT_LENGTH));
        return this.ok("true");
    }

    this.values.set(element, text);
    return this.ok("true");
  }

  LMSCommit(parameter: string = ""): string {
    if (parameter !== "") return this.fail("201");
    if (this.state !== "running") return this.fail("301");
    this.options.onCommit(this.buildPayload(false));
    return this.ok("true");
  }

  LMSGetLastError(): string {
    return this.lastError;
  }

  LMSGetErrorString(code: unknown): string {
    return ERRORS[String(code ?? "")] ?? "";
  }

  LMSGetDiagnostic(code: unknown): string {
    const key = code === "" || code === null || code === undefined ? this.lastError : String(code);
    return ERRORS[key] ?? "";
  }

  /** Snapshot for a save the content did not ask for (e.g. the page is being closed). */
  snapshot(): CommitPayload | null {
    return this.state === "running" ? this.buildPayload(false) : null;
  }

  private isKnown(element: string): boolean {
    return SCALAR_ELEMENTS.has(element) || OBJECTIVE.test(element) || INTERACTION.test(element);
  }

  /** Number of indexes used under an array element such as "cmi.objectives". */
  private countChildren(prefix: string): number {
    const indexes = new Set<string>();
    for (const key of this.values.keys()) {
      if (key.startsWith(`${prefix}.`)) {
        const index = key.slice(prefix.length + 1).split(".")[0];
        if (/^\d+$/.test(index)) indexes.add(index);
      }
    }
    return indexes.size;
  }

  private buildPayload(finished: boolean): CommitPayload {
    const cmi: CmiData = {};
    for (const [key, value] of this.values) {
      // Read-only elements are owned by the LMS; session_time travels as sessionSeconds.
      if (!READ_ONLY.has(key) && key !== "cmi.core.session_time") cmi[key] = value;
    }
    const declared = parseScormTime(this.values.get("cmi.core.session_time") ?? "");
    const elapsed = Math.max(0, (this.now() - this.startedAt) / 1000);
    return { cmi, sessionSeconds: Math.round(declared ?? elapsed), finished };
  }

  private ok(result: string): string {
    this.lastError = "0";
    return result;
  }

  private fail(code: string, result: string = "false"): string {
    this.lastError = code;
    return result;
  }
}
