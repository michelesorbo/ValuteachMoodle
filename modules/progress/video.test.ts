import { describe, expect, it } from "vitest";
import {
  isVideoCompleted,
  looksLikeMp4,
  mergeRanges,
  normalizeRanges,
  watchedFraction,
  watchedPercent,
  watchedSeconds,
  type TimeRange,
} from "./video";

describe("normalizeRanges", () => {
  it("sorts and merges overlapping or touching ranges", () => {
    expect(
      normalizeRanges(
        [
          [50, 60],
          [0, 10],
          [5, 20],
          [20.2, 30],
        ],
        100,
      ),
    ).toEqual([
      [0, 30],
      [50, 60],
    ]);
  });

  it("keeps real gaps, so skipping ahead is not counted as watched", () => {
    const skipping = Array.from({ length: 10 }, (_, i): TimeRange => [i * 10, i * 10 + 1]);
    expect(normalizeRanges(skipping, 100)).toHaveLength(10);
    expect(watchedPercent(skipping, 100)).toBe(10);
  });

  it("clamps to the video and drops invalid ranges", () => {
    expect(
      normalizeRanges(
        [
          [-5, 10],
          [90, 500],
          [40, 40],
          [30, 20],
          [Number.NaN, 5],
          [200, 300],
        ],
        100,
      ),
    ).toEqual([
      [0, 10],
      [90, 100],
    ]);
  });

  it("returns nothing without a valid duration", () => {
    expect(normalizeRanges([[0, 10]], 0)).toEqual([]);
    expect(normalizeRanges([[0, 10]], Number.NaN)).toEqual([]);
    expect(normalizeRanges([[0, 10]], Number.POSITIVE_INFINITY)).toEqual([]);
  });
});

describe("watched time", () => {
  it("does not count the same part twice", () => {
    const ranges: TimeRange[] = [
      [0, 30],
      [10, 30],
      [0, 30],
    ];
    expect(watchedSeconds(normalizeRanges(ranges, 100))).toBe(30);
    expect(watchedFraction(ranges, 100)).toBe(0.3);
  });

  it("adds up viewing sessions", () => {
    const first = mergeRanges([], [[0, 40]], 100);
    const second = mergeRanges(first, [[60, 100]], 100);
    expect(second).toEqual([
      [0, 40],
      [60, 100],
    ]);
    expect(watchedPercent(second, 100)).toBe(80);
    expect(watchedPercent(mergeRanges(second, [[38, 62]], 100), 100)).toBe(100);
  });
});

describe("isVideoCompleted", () => {
  it("completes at 90% watched", () => {
    expect(isVideoCompleted([[0, 89]], 100)).toBe(false);
    expect(isVideoCompleted([[0, 90]], 100)).toBe(true);
    expect(isVideoCompleted([[0, 100]], 100)).toBe(true);
    expect(watchedPercent([[0, 90]], 100)).toBe(90);
  });

  it("is not fooled by jumping to the end", () => {
    expect(isVideoCompleted([[0, 5], [95, 100]], 100)).toBe(false);
  });

  it("counts separate parts that add up to 90%", () => {
    expect(isVideoCompleted([[0, 45], [55, 100]], 100)).toBe(true);
  });

  it("is never completed without a duration or with nothing watched", () => {
    expect(isVideoCompleted([], 100)).toBe(false);
    expect(isVideoCompleted([[0, 100]], 0)).toBe(false);
  });
});

describe("looksLikeMp4", () => {
  it("recognizes the ftyp box", () => {
    const mp4 = new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
    expect(looksLikeMp4(mp4)).toBe(true);
  });

  it("rejects other files", () => {
    expect(looksLikeMp4(new TextEncoder().encode("<html><body>ciao</body></html>"))).toBe(false);
    expect(looksLikeMp4(new Uint8Array([0x66, 0x74, 0x79, 0x70]))).toBe(false);
    expect(looksLikeMp4(new Uint8Array())).toBe(false);
  });
});
